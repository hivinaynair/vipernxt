import { hash } from "../factory/core";
export type Issue = {
  id: string;
  title: string;
  description: string | null;
  archivedAt: string | null;
  team: { id: string };
  parent?: { id: string } | null;
  state: { id: string; type: string };
  relations: {
    nodes: { type: string; relatedIssue: { id: string } }[];
    pageInfo: { hasNextPage: boolean };
  };
};
export function issueHash(issue: Issue) {
  if (issue.relations.pageInfo.hasNextPage)
    throw new Error("Too many issue relations; narrow the ticket");
  return hash({
    title: issue.title,
    description: issue.description,
    team: issue.team.id,
    parent: issue.parent?.id ?? null,
    relations: issue.relations.nodes.map((r) => `${r.type}:${r.relatedIssue.id}`).sort(),
  });
}
export class Linear {
  private token?: { value: string; expires: number };
  private pending?: Promise<string>;
  constructor(
    private clientId: string,
    private secret: string,
    private transport: typeof fetch = fetch,
  ) {}
  private async access(): Promise<string> {
    if (this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      const res = await this.transport("https://api.linear.app/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.secret,
          scope: "read,write,app:mentionable,app:assignable",
        }),
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (!res.ok) throw new Error(`Linear OAuth HTTP ${res.status}`);
      const data = (await res.json()) as { access_token: string; expires_in: number };
      if (!data.access_token || !Number.isFinite(data.expires_in))
        throw new Error("Invalid Linear token response");
      this.token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
      return data.access_token;
    })();
    try {
      return await this.pending;
    } finally {
      this.pending = undefined;
    }
  }
  async query<T>(query: string, variables: unknown = {}): Promise<T> {
    const res = await this.transport("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.access()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (res.status === 401) this.token = undefined;
    if (!res.ok) throw new Error(`Linear HTTP ${res.status}`);
    const body = (await res.json()) as { data: T; errors?: unknown[] };
    if (body.errors?.length || !body.data)
      throw new Error("Linear GraphQL request failed; no partial result accepted");
    return body.data;
  }
  async identity() {
    return this.query<{ viewer: { id: string; url: string }; organization: { id: string } }>(
      "query { viewer { id url } organization { id } }",
    );
  }
  async issue(id: string) {
    const data = await this.query<{ issue: Issue }>(
      `query($id:String!){issue(id:$id){id title description archivedAt team{id} parent{id} state{id type} relations(first:100){nodes{type relatedIssue{id}} pageInfo{hasNextPage}}}}`,
      { id },
    );
    if (!data.issue) throw new Error("Linear issue unavailable");
    return data.issue;
  }
  async comment(id: string) {
    return (
      await this.query<{ comment: { body: string } }>("query($id:String!){comment(id:$id){body}}", {
        id,
      })
    ).comment.body;
  }
  async activity(id: string, session: string, body: string, type = "response") {
    // A persisted UUID makes retry after a lost mutation response reconcilable.
    const prior = await this.query<{ agentActivities: { nodes: { id: string }[] } }>(
      "query($id:ID!){agentActivities(filter:{id:{eq:$id}},first:1){nodes{id}}}",
      { id },
    );
    if (prior.agentActivities.nodes.length) return;
    const result = await this.query<{ agentActivityCreate: { success: boolean } }>(
      "mutation($input:AgentActivityCreateInput!){agentActivityCreate(input:$input){success}}",
      { input: { id, agentSessionId: session, content: { type, body } } },
    );
    if (!result.agentActivityCreate.success) throw new Error("Linear activity was not saved");
  }
  async state(issue: string, state: string) {
    const result = await this.query<{ issueUpdate: { success: boolean } }>(
      "mutation($id:String!,$input:IssueUpdateInput!){issueUpdate(id:$id,input:$input){success}}",
      { id: issue, input: { stateId: state } },
    );
    if (!result.issueUpdate.success) throw new Error("Linear state was not saved");
  }
}
