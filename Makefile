start-services:
	- ./docker/scripts/init.sh
stop-services:
	- docker compose down
build:
	- docker build -f ./Dockerfile-prod -t ms-ticket-container:latest .
start:
	- docker run --name ms-ticket-container -p 5019:80 -d ms-ticket-container:latest
exec:
	- docker exec -it ms-ticket-container /bin/sh
logs:
	- docker logs -f --tail 50 --timestamps ms-ticket-container
