.PHONY: contracts
REPO = asaswap

all: contracts

contracts:
	python -m contracts.asaswap

clean:		## Remove python cache files
	find . -name '__pycache__' | xargs rm -rf
	find . -name '*.pyc' -delete
	rm -rf .pytest_cache

image:		## Build the docker image
	make clean
	docker build \
		-t $(REPO) .

services-d:
	docker-compose -f docker-compose-tests.yml up -d

services-down:
	docker-compose -f docker-compose-tests.yml down
	rm -rf ./data-test

services:
	docker-compose -f docker-compose-tests.yml up

test: 		## Run flake8, migrations & unit tests
	docker run --rm \
						--net asaswap \
						--link algorandsandbox:algorandsandbox \
						 $(REPO) pytest
