## Using FerretDB in place of MongoDB

### Overview

Go.Data works best with MongoDB because of its extensive features and flexibility. However, if you would like to use a fully Open Source alternative, you may configure [FerretDB](https://docs.ferretdb.io/), a proxy that translates MongoDB protocol queries to SQL, with PostgreSQL (or SQLite) as the database engine.

## Steps

### 1. Set up FerretDB and PostgreSQL locally with Docker

Use the [intructions from FerretDB documentation](https://docs.ferretdb.io/quickstart-guide/docker/) to deploy FerretDB.

You will be asked do a local setup of FerretDB and PostgreSQL using Docker Compose.

### 2. Run the Go.Data installer with the FerretDB arguments in place of the MongoDB arguments

In the [Download Installer](https://github.com/WorldHealthOrganization/GoDataSource-Installers?tab=readme-ov-file#5-download-installer) step of creating a running the Go.Data installers, pass the FerretDB arguments in `--dbport` and `--dbpath`. 

For MacOS and Windows installations, these arguments may be requested during the installation process.

Note: Go.Data has not been extensively tested with FerretDB. The Go.Data maintainers will update these steps as further improvements are made to the Go.Data project.