FROM oven/bun:1.4.0-debian
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /controller
COPY scripts/factory.ts scripts/controller.ts ./scripts/
COPY scripts/factory ./scripts/factory
COPY scripts/controller ./scripts/controller
COPY deploy/controller/git-askpass.sh /usr/local/bin/factory-git-askpass
RUN chmod 755 /usr/local/bin/factory-git-askpass
ENV GIT_ASKPASS=/usr/local/bin/factory-git-askpass GIT_TERMINAL_PROMPT=0
EXPOSE 8080
CMD ["bun", "scripts/controller.ts"]
