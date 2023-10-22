---
title: Prisma + Webpack + Docker 踩坑筆記
date: 2023-07-04
categories: [random]
tags: [prisma, webpack, docker]
math: true
---

# Preface
前陣子為了其他系列的部落格文章的 lab，在練習一個簡單的 REST-ful API 的專案\
途中遇到不少的困難，想說寫起來紀錄一下

用到的 tech stack 如題所述，稍微簡介一下\
[Prisma](https://www.prisma.io/) 是一款專為 Node.js 而誕生的 ORM 套件，透過 ORM 工具可以讓你輕鬆的序列化資料，不用自己硬刻轉換資料的部份\
[Webpack](https://webpack.js.org/) 則是負責將所有的檔案 "打包" 的一項工具\
當然還有我們的老朋友 [Docker](https://www.docker.com/) 

# Environment
```
$ npx prisma version
prisma                  : 4.16.2
@prisma/client          : 4.16.2
Current platform        : debian-openssl-3.0.x
Query Engine (Node-API) : libquery-engine 4bc8b6e1b66cb932731fb1bdbbc550d1e010de81 (at node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node)
Migration Engine        : migration-engine-cli 4bc8b6e1b66cb932731fb1bdbbc550d1e010de81 (at node_modules/@prisma/engines/migration-engine-debian-openssl-3.0.x)
Format Wasm             : @prisma/prisma-fmt-wasm 4.16.1-1.4bc8b6e1b66cb932731fb1bdbbc550d1e010de81
Default Engines Hash    : 4bc8b6e1b66cb932731fb1bdbbc550d1e010de81
Studio                  : 0.484.0

$ npx webpack version
System:
    OS: Linux 5.19 Ubuntu 22.04.2 LTS 22.04.2 LTS (Jammy Jellyfish)
    CPU: (12) x64 AMD Ryzen 5 2600 Six-Core Processor
    Memory: 22.04 GB / 31.28 GB
  Binaries:
    Node: 18.15.0 - /usr/local/bin/node
    Yarn: 1.22.19 - /usr/local/bin/yarn
    npm: 9.5.0 - /usr/local/bin/npm
  Browsers:
    Chrome: 114.0.5735.133
  Packages:
    copy-webpack-plugin: ^11.0.0 => 11.0.0 
    dotenv-webpack: 8.0.1 => 8.0.1 
    node-polyfill-webpack-plugin: ^2.0.1 => 2.0.1 
    ts-loader: ^9.4.4 => 9.4.4 
    webpack: ^5.88.1 => 5.88.1 
    webpack-cli: ^5.1.4 => 5.1.4 
    webpack-obfuscator: ^3.5.1 => 3.5.1

$ docker -v
Docker version 24.0.2, build cb74dfc
```

# How does Prisma Work
開發者透過定義 schema.prisma 檔案，定義資料庫的 table 結構，內容大概會長這樣
```javascript
datasource db {
    provider = "mysql"
    url      = env("DATABASE_URL")
}

generator client {
    provider      = "prisma-client-js"
}

model User {
    id            String       @id
    username      String
    created_at    DateTime     @default(now())
    last_login_at DateTime     @updatedAt
    RoomMember    RoomMember[]
    Message       Message[]
}

...
```

主要就是三個部份
1. datasource
    + 定義你用哪一種資料庫(e.g. `mysql`, `postgresql`)，然後他的 URL
2. generator
    + 為了要生成對應的 typing(for TypeScript)
    + 畫個重點，這裡很重要，跟 Webpack 有關
3. model
    + 最後這裡就是定義 Table schema, 你可以定義多個 model

<hr>

這時候，資料庫並沒有這些定義\
所以要想辦法同步進去

由於 Prisma 本身是透過 JavaScript client 進行操作的(詳見 [Prisma Architecture](#prisma-architecture))\
所以要先將客戶端生成出來
```shell
$ npx prisma generate --schema schema.prisma
```

> generate 會在 `npm i` 的時候自動執行

然後就要同步 schema 了
```shell
$ npx prisma migrate dev --name init --schema schema.prisma
```

> 注意到一點，當你 migration 完成之後\
> migration 的 history 檔案也務必要加入版控裡面

> 預設定義檔路徑是 ./schema.prisma\
> 如果你放在別的地方要指過去

到這裡，基本上你就設定完成了\
然而，事情才剛剛開始

# Prisma Architecture
在眾多 Node.js ORM 框架裡，[Prisma](https://www.prisma.io/) 是稍微年輕的後起之秀\
而他的架構，是由 client 以及 server 所組成的，如下所示
![](https://www.prisma.io/docs/static/f7f69d7ae3a122fcbb8dea030d70807b/d880f/query-engine-node-js-at-runtime.png)
> ref: [The query engine at runtime](https://www.prisma.io/docs/concepts/components/prisma-engines/query-engine)

Prisma 透過 JavaScript client 與 Query Engine 進行溝通，然後才到資料庫進行查詢\
npx prisma generate 這行指令，上一節才看到，它會負責生成 client 以及 engine

注意到，query engine 是 binary(aka. 執行檔)\
它會根據你目前的系統，自動下載相對應的 binary 到 `node_modules/@prisma/engines` 以及 `node_modules/.prisma/client` 裡頭

> @prisma/client :arrow_right: prisma module 本體，下載後就不會改動了\
> .prisma/client :arrow_right: 根據你的 schema.prisma 動態生成的

檔案名稱的規則為

|Prefix|Platform|Postfix|Image|
|:--|:--|:--|:--|
|`libquery_engine-`|[Platform list](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#binarytargets-options)|`.so.node`|![](/assets/img/posts/prisma1.png)|
|`query-engine-`|[Platform list](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#binarytargets-options)||![](/assets/img/posts/prisma2.png)|

# Bundle all Source Code
當你完成你的程式碼，並且將他們打包的時候\
你會意識到一個問題，在 [Prisma Architecture](#prisma-architecture) 裡面有提到，Prisma 有一個 query engine 的 binary\
而一般情況下，webpack 不會處理它，你需要手動將 binary 打包起來

這時候你需要 [copy-webpack-plugin](https://www.npmjs.com/package/copy-webpack-plugin)

## copy-webpack-plugin
透過 npm 安裝
```shell
$ npm i -D copy-webpack-plugin
```

webpack.config.js 裡面加入 plugin
```javascript
const CopyPlugin = require("copy-webpack-plugin");
const path = require("path");

module.exports = {
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: "./src/database/prisma/schema.prisma",
                    to: "./schema.prisma",
                },
                {
                    from: path.join(
                        __dirname,
                        "./node_modules/.prisma/client/query-engine-linux-musl-openssl-3.0.x"
                    ),
                    to: "./query-engine-linux-musl-openssl-3.0.x",
                },
                {
                    from: path.join(
                        __dirname,
                        "./node_modules/.prisma/client/query-engine-debian-openssl-3.0.x"
                    ),
                    to: "./query-engine-debian-openssl-3.0.x",
                },
            ],
        }),
    ]
}
```

copy-webpack-plugin 基本用法就是這樣，複製某個檔案到某個位置\
prisma 初始化的時候會跑兩個指令(`generate` 以及 `migrate`)\
所以 schema 的定義檔也必須要複製進去，再來就是 query engine 的 binary 檔案

細心的你發現到，怎麼這裡複製的 binary 位置跟 [Prisma Architecture](#prisma-architecture) 裡面講的不一樣?\
prisma 預設會幫你下載跟系統一致的 binary(e.g. `libquery_engine-debian-openssl-3.0.x.so.node`) 要用它自然也是沒問題的\
只不過我的例子是開發環境跟正式環境所使用的系統不一樣(`ubuntu` 以及 `alpine`)\
prisma 提供了一個選項，可以指定你要用的 binary 有哪些\
所以設定檔可以改成這樣寫
```javascript
generator client {
    provider      = "prisma-client-js"
    binaryTargets = ["linux-musl-openssl-3.0.x", "debian-openssl-3.0.x"]
    engineType    = "binary"
}
```
其中，binaryTargets 可以在 [Platform list](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#binarytargets-options) 找到\
然後切記 engineType 也要設定成 binary, 不然它會抓不到

> 這裡我有兩個 binary targets, 分別對應到 `ubuntu 22.04` 以及 `alpine`\
> 你可以指定多個 binary, 它會自己抓合適的使用

而你指定的 binary, 會被下載到 `node_modules/.prisma/client` 裡面，如圖所示
![](/assets/img/posts/prisma2.png)

## Module not found: Error: Can't resolve 'fs'
webpack 5 以上，當你在打包的時候可能噴一堆 error 說它找不到 `fs`, `http`, `crypto` ... etc.\
一個簡單的作法是使用 [node-polyfill-webpack-plugin](https://www.npmjs.com/package/node-polyfill-webpack-plugin) plugin\
你的 webpack.config.js 就會變成以下
```javascript
const NodePolyfillPlugin = const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.export = {
    plugins: [
        new NodePolyfillPlugin()
    ]
}
```

但是它會造成一點問題，可以參考 [TypeError: argument entity must be string, Buffer, or fs.Stats](#typeerror-argument-entity-must-be-string-buffer-or-fsstats)\
有一個更簡單的方法，只要將 `target` 設為 `node` 即可
```javascript
module.export = {
    target: 'node',
}
```

## TypeError: argument entity must be string, Buffer, or fs.Stats
如果你跑起來，有遇到
```shell
TypeError: argument entity must be string, Buffer, or fs.Stats
    at etag (/[...]/node_modules/etag/index.js:83:11)
    at generateETag ([...]/node_modules/express/lib/utils.js:280:12)
    at ServerResponse.send ([...]/node_modules/express/lib/response.js:200:17)
    at ServerResponse.json ([...]/node_modules/express/lib/response.js:267:15)
    at api.post (/the/code/above)
```
這個問題，是因為你在 webpack.config.js 裡面用了 [node-polyfill-webpack-plugin](https://www.npmjs.com/package/node-polyfill-webpack-plugin) plugin\
把它移除之後就可以了
```javascript
module.export = {
    plugins: [
        // new NodePolyfillPlugin()
    ]
}
```

# Prisma Migration Inside Docker Container
將 application 容器化算是一個好習慣吧，至少對我來說這樣可以很方便的測試\
但是碰上 Prisma 整體會稍微麻煩一點，且聽我娓娓道來

`$ npx prisma migrate` 的功用還記得嗎？ 就是將 table schema 同步到資料庫裡面\
可是這行指令必須在你的 application container 裡面執行才可以(因為它需要 `@prisma/client` 以及你的 schema)\
現今主流 container 的作法是把 app 跟 database 拆開\
問題來了，你要怎麼同步 schema?

還有一點是，我們在 `schema.prisma` 裡面定義 URL 的時候是採環境變數的方式
```javascript
datasource db {
    provider = "mysql"
    url      = env("DATABASE_URL")
}
```
要怎麼處理這塊也是一個問題

<hr>

關於第二點其實如果你不用 environment variable 的寫法也不是不行\
可以維護兩份不一樣的 schema 定義，在下 command 的時候指到不同的檔案\
也可以 work 但顯然這樣有點蠢

## Prisma Migration History
每一次你執行 `$ npx prisma migrate` 的時候，它會生成一個 `sql` 檔，存放於 `./migrations`\
裡面紀錄了每一次 migration 的 sql 檔\
既然我有 `.sql` 那不用手動執行 `$ npx prisma migrate` 也沒差，還更省事

假設你用的 image 是 [mariadb](https://hub.docker.com/_/mariadb)\
有一個貼心的功能是，當資料庫 boot 的時候，它會自動執行所有放在 `/docker-entrypoint-initdb.d` 底下的檔案們(e.g. `.sql`, 可參考 [Initializing a fresh instance](https://hub.docker.com/_/mariadb))

因此你可以這樣做
1. 複製最新的 migration sql 檔案
2. 客製化 docker image, 將 sql 檔案塞入 `/docker-entrypoint-initdb.d`

如此一來，不需要手動執行指令，也可以初始化資料庫 table 了

```sql
USE restdb;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> 注意到 prisma 生成的 sql 裡面沒有指定資料庫\
> 你需要手動指定(`USE xxx`)

```dockerfile
FROM mariadb:latest
COPY ./init.sql /docker-entrypoint-initdb.d/
```

> 另外如果你需要初始化資料 .csv 之類的檔案\
> 記得放在 /var/lib/mysql **以外** 的地方，由於權限問題，docker 沒辦法複製到這裡面

# process.env undefined in Node Docker Image
同樣也是跟 prisma 有點相關的慘劇
```javascript
datasource db {
    provider = "mysql"
    url      = env("DATABASE_URL")
}
```
除了 prisma 的環境變數，你可能有其他的環境變數設定要載入\
不知道為啥，即使在 docker-compose.yaml 當中有設定環境變數，進去 container 裡面也看得到\
但 application 就是啥都沒有

我原本用的 [dotenv](https://www.npmjs.com/package/dotenv) 它只會從檔案裡面讀取 `.env`\
研判是這個導致的問題，因為在打包的過程中我並沒有將設定檔一併帶入，取而代之的是在 docker-compose.yaml 裡面定義

## dotenv-webpack
後來我找到一款第三方的 webpack plugin [dotenv-webpack](https://www.npmjs.com/package/dotenv-webpack)\
它可以讀取系統層級的環境變數，並載入使用\
安裝也如同先前
```shell
$ npm i -D dotenv-webpack
```

webpack.config.js 可以改成以下
```javascript
const Dotenv = require("dotenv-webpack");

module.export = {
    plugins: [
        new Dotenv({
            systemvars: true,
            path: path.join(__dirname, "./.env"),
        }),
    ]
}
```

除了載入 `.env` 之外，也將系統層級的環境變數寫入 `process.env` 裡面\
這樣就可以 work 了

# Example
有關上述所有的程式碼實做，你可以在 [ambersun1234/blog-labs/cursor-based-pagination](https://github.com/ambersun1234/blog-labs/tree/master/cursor-based-pagination) 找到

# References
+ [Express Response.send() throwing TypeError](https://stackoverflow.com/questions/49374802/express-response-send-throwing-typeerror)
+ [Generating Prisma Client](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/generating-prisma-client#the-prismaclient-npm-package)
+ [Module bundlers](https://www.prisma.io/docs/concepts/components/prisma-client/module-bundlers)
+ [Configuring the query engine](https://www.prisma.io/docs/concepts/components/prisma-engines/query-engine#configuring-the-query-engine)
+ [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
+ [About migration histories](https://www.prisma.io/docs/concepts/components/prisma-migrate/migration-histories)
