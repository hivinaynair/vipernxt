export async function assertApprovedIntake(params: {
  intake: string;
  base: string;
  targetHead: string;
  isAncestor: (ancestor: string, descendant: string) => Promise<boolean>;
}) {
  if (!(await params.isAncestor(params.intake, params.targetHead)))
    throw new Error("Intake commit is not on the target branch");
  if (!(await params.isAncestor(params.base, params.intake)))
    throw new Error("Approved base is not an ancestor of the intake commit");
}
