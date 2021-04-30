REPO = asaswap

all: contracts

contracts:
	poetry run yarn algob compile

clean:		## Remove python cache files
	find . -name '__pycache__' | xargs rm -rf
	find . -name '*.pyc' -delete
	rm -rf .pytest_cache

image:		## Build the docker image
	make clean
	docker build \
		-t $(REPO) .

tests: 		## Run eslint and tests
	docker run -it --rm \
		$(REPO) yarn lint && docker run -it --rm $(REPO) poetry run yarn test
	cd assets/helpers && docker run -it --rm $(REPO) poetry run python -m pytest

ci-tests:       ## Run eslint and tests
	docker run --rm \
		$(REPO) yarn lint && docker run --rm $(REPO) poetry run yarn test
	cd assets/helpers && docker run --rm $(REPO) poetry run python -m pytest