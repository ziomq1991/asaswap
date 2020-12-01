FROM python:3.7

WORKDIR /app

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN pip install poetry

COPY pyproject.toml pyproject.toml
COPY poetry.lock poetry.lock

ENV POETRY_VIRTUALENVS_CREATE=false

RUN poetry install

ADD . .
