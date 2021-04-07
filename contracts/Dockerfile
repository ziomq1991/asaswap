FROM nikolaik/python-nodejs:python3.9-nodejs15	

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

WORKDIR /

RUN yarn global add mocha

WORKDIR /app

COPY package.json package.json
COPY yarn.lock yarn.lock

RUN yarn install --dev

COPY pyproject.toml pyproject.toml
COPY poetry.lock poetry.lock
RUN poetry install

ADD . .
