# U_luv local development — Java DynamoDB Local (no Docker)

The default local database is the official AWS DynamoDB Local **Java JAR** (Java 17+). `infra/local/compose.yml` from v1.0 is deprecated and removed. There are **no** Docker, Docker Desktop, Compose, ECS, AWS account or real AWS database prerequisites for phases P00–P15.

See [`../../docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md`](../../docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md) and `scripts/dev/start-local.ps1`.
