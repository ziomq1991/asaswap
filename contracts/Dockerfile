FROM nikolaik/python-nodejs:python3.9-nodejs15	

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

WORKDIR /
RUN git clone https://github.com/scale-it/algorand-builder.git
WORKDIR /algorand-builder
RUN git checkout 606efcfe998f497bccd5b9e92f214664096ad50d
RUN yarn install
RUN yarn build
RUN cd packages/algob && yarn link
RUN cd packages/runtime && yarn link

RUN yarn global add mocha

WORKDIR /app

COPY package.json package.json
COPY yarn.lock yarn.lock

RUN yarn install --dev
RUN yarn link "@algorand-builder/algob"
RUN yarn link "@algorand-builder/runtime"

COPY pyproject.toml pyproject.toml
COPY poetry.lock poetry.lock
RUN poetry install

ADD . .
