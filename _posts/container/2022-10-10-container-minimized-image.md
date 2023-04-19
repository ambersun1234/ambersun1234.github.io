---
title: Container 技術 - 最小化 Docker Image
date: 2022-12-04
categories: [container]
tags: [docker, linux]
math: true
---

# Why Do we Need to Minimize Image
Image 的大小對開發本身來說有很大的影響嗎？\
考慮到要 deploy, pull image 這件事情來說，如果遇到網路速度慢的情況下\
等個幾分鐘對於開發者來說真的會大幅度的拖慢進度\
因此，如果 image 大小能維持在幾 MB, 是在好不過得事情了

換言之，好處就是
+ 上傳下載 image 的時間可以縮短
+ 佔用硬碟空間少

# Ways to Minimized Image
## Smaller Base Image
最直觀也最容易想到的方法之一，用小一點的 image 就可以縮小 docker image size 了\
舉凡我們平常使用的 golang, ubuntu\
他們的大小

|Image|Size|
|:--|:--:|
|[golang 1.19](https://hub.docker.com/_/golang)|992 MB|
|[ubuntu 22.04](https://hub.docker.com/_/ubuntu)|77.8 MB|

但是這樣還不夠小\
![](https://www.alpinelinux.org/alpinelinux-logo.svg)\
Alpine Linux 是安全且輕量的發行版 基於 [musl libc](https://www.musl-libc.org/) 以及 [BusyBox](https://www.busybox.net/), 其大小只有 130 MB\
而 Docker 版的 [Alpine](https://hub.docker.com/_/alpine), image size 僅僅只有 `7.05 MB`\
這使得目前主流推薦都使用這個發行版作為 base image

## Don't Install Unused Tools
舉凡像是 [cURL](https://curl.se/), [Vim](https://www.vim.org/) ... etc. 這些工具，都會極大的增加 image 大小\
因此不建議安裝這些在 image 裡面(畢竟你可能久久才開一次)

但是如果說你的安裝過程需要用到 curl 安裝第三方 package 呢？\
裝是當然要裝的，但是能不能不要把它包進去 image 裡面呢？ 可參考 [Multi-stage Build](#multi-stage-build)

## Volume
對於某些 application 會依賴相當多的 config 檔，如果檔案太大，與其把它寫入 image 裡面，也可以試著使用 volume 將資料掛載進去，減少 image 空間

## Store only Binaries instead of Source Code
有一個絕大多數人會忽略的一個點是\
把你的程式跑起來，**只需要 binary 就行**(source code 其實並不需要的)\
因為相比於 binary 執行檔，你的 source code 大小肯定是大的多\
那 binary 理所當然是從你的原始碼 compile 得到的

> 對於直譯式語言如 python, 仍然有 pyinstaller, p2exe 等等的解法可以打包成 binary

具體的作法有兩個選擇
1. 將 source code 包進去 image, 並在 docker build 的時候生出 binary
2. 在你的本地端直接 compile，單純的包 binary 進去 image

這兩種，無非都是很爛的選擇
1. 第一種作法你還是會把 source code 包進去，對於最小化 docker image 可以說是一點幫助都沒有
2. 這種作法看似沒問題，但是每個人的環境都不同，可能包進去雜七雜八的東西，可行性也不高

可行的作法是，一樣把 source code 塞進去，生成 binary 之後, 再把 source 拔掉就好
> 這裡說的不是單純的 rm -rf application/ (這樣還是沒用，可參考 [Minimized Layer](#minimize-layer))\
> 而是透過 [Multi-stage Build](#multi-stage-build) 達成

我手上有一個數據，公司的 CI/CD pipeline 把整包 source code 一起包到 image 裡面\
我把它改成只包 binary 的情況下，image 大小縮小的大約 **5176%**(從 2 GB 多直接縮減到 45.7 MB)

<hr>

在 [ambersun1234/minimized-docker-image-lab](https://github.com/ambersun1234/minimized-docker-image-lab) 裡面我提供了一個簡單的 echo API 實做\
把 source code 包進去的跟只包 binary 的他們的差別如下

||with source code|binary only|
|:--|:--:|:--:|
|Implementation|[Multi-stage Build](https://github.com/ambersun1234/minimized-docker-image-lab/tree/master/multi-stage)|[Non-optimized](https://github.com/ambersun1234/minimized-docker-image-lab/tree/master/non-optimized)|
|Size|1.18 GB|17.6 MB|
|Layer|10|2|

## Decouple Applications
將 application 分成多個 container 也有助於降低 image size\
同時，如果有需要做擴展，分開也有助於 scale

## .dockerignore
跟 .gitignore 一樣，docker 也有 `.dockerignore`

ignore 檔裡面的規則最好是包含那些可以被自動生成的\
像是 執行檔，暫存檔 等等的\
將這些放到 image 裡面是完全沒有任何幫助的\
因此將這些規則一併寫入 ignore file 也有助於縮小 image

## Minimize Layer
考慮以下 Dockerfile
```dockerfile
FROM ubuntu:18.04
LABEL org.opencontainers.image.authors="org@example.com"
COPY . /app
RUN make /app
RUN rm -r $HOME/.cache
CMD python /app/app.py
```

Docker 的運作方式是，將每一行指令都疊加在先前的 layer 上面
> 注意到只有 `RUN`, `COPY`, `ADD` 這三個指令會疊加
聰明的你必然得出一個結論，每一次的疊加都會增加 image 大小

所以以上的 Dockerfile 他的層數總共有 4 層
![](https://docs.docker.com/storage/storagedriver/images/container-layers.jpg)

那我就好奇了\
單純的減少層數，能夠縮減多少？\
考慮以下實做程式碼
```dockerfile
// origin version
FROM ubuntu:22.04

RUN apt update && apt upgrade -y
RUN apt install vim -y
RUN apt install curl -y
RUN apt install wget -y
RUN apt install build-essential -y
RUN apt install make -y
RUN apt install cmake -y
```
跟這種
```dockerfile
// optimized version
FROM ubuntu:22.04

RUN apt update && apt upgrade -y
RUN apt install vim curl wget build-essential make cmake -y
```

他們究竟有沒有差別？\
build 起來之後，他們的大小, 層數分別是

||origin|optimized|
|:--|:--|:--|
|Size|527 MB|522 MB|
|Layer|8|3|

{% raw %}
透過指令 `$ docker image inspect --format "{{json .RootFS.Layers}}" xxxxx` 分別查看 \
他們的結果是
```shell
$ docker image inspect --format "{{json .RootFS.Layers}}" minimized-layer-origin
[
  "sha256:f4a670ac65b68f8757aea863ac0de19e627c0ea57165abad8094eae512ca7dad",
  "sha256:ae52e443d3533afa7cdb2a56be73801a3fd82154e9b6d37ea9ca1b1a3f2fd6e1",
  "sha256:469d1c4a0652e0da96c08c547cd8a2e398099e9428b9ebf90acaa0539c1d2b13",
  "sha256:25e5cd9275c6c89686a96c5084ddc3038f3ae4fec68dc306ad3c2836a11b83e8",
  "sha256:3ad9d501a659b754fb9ca008e00fc3e7378268958e606696b9a759540f6c421a",
  "sha256:6dc9c5658e1222bc029ade98126ae5a6fb910c291a49db04c3396aff8abff2e0",
  "sha256:7c586f24c4476990dbce13dbdbb18cc0ad204320fb0044e52e9c5243b11e74f3",
  "sha256:2bb6f8743c914aa3c3f9afae740dbc654629b04f25242ea4143c319a76f24e16"
]
```
```shell
$ docker image inspect --format "{{json .RootFS.Layers}}" minimized-layer-optimized
[
  "sha256:f4a670ac65b68f8757aea863ac0de19e627c0ea57165abad8094eae512ca7dad",
  "sha256:ae52e443d3533afa7cdb2a56be73801a3fd82154e9b6d37ea9ca1b1a3f2fd6e1",
  "sha256:f9c2c95623fff836deba2495abd894325b8f804340e0c1f5f3e1829560c23307"
]
```
{% endraw %}

可以看到 確實阿\
只用一行指令執行完所有 package install 的 image 他的層數比較少 只有 3 層\
相對的一個 package 一行的就有 8 層

仔細觀察你可以發現到\
他們前兩個的 hash 是一樣的 不難可以想到因為他們跑得指令都相同(所以 docker 其實會共用 layer)\
好比如說 `apt update && apt upgrade -y` 這行的 hash 是 **ae52e443d3533afa7cdb2a56be73801a3fd82154e9b6d37ea9ca1b1a3f2fd6e1**\
那我是不是可以大膽的假設 **f4a670ac65b68f8757aea863ac0de19e627c0ea57165abad8094eae512ca7dad** 這串 hash 是 `ubuntu:22.04` 的 image hash 呢？

用 docker inspect 檢查
```shell
$ docker inspect ubuntu:22.04

        xxx

        "RootFS": {
            "Type": "layers",
            "Layers": [
                "sha256:f4a670ac65b68f8757aea863ac0de19e627c0ea57165abad8094eae512ca7dad"
            ]
        },

        xxx
```
在 **RootFS** 那裡你可以看到 layers 那邊正好就是我們這裡第一層 layer sha256 的結果\
得證

實驗程式碼可以參考 [ambersun1234/minimized-docker-image-lab](https://github.com/ambersun1234/minimized-docker-image-lab)

## Multi-stage Build
multi stage build 是終極大招，它很好的解決了上述 multiple layer 以及 application binary 的問題\
具體來說，他是在 build time 建構多個 stage image, 每個 stage 都自上一個 stage 拿取需要的東西\
直接看一個例子吧
```dockerfile
FROM golang:1.19 AS builder_stage
WORKDIR /
COPY ./echo ./
RUN go mod download
RUN CGO_ENABLED=0 go build -o server

FROM alpine:latest AS final_stage
WORKDIR /
COPY --from=builder_stage /server .
CMD ["/server"]
```

可以清楚的看到，這裡用了兩個 `FROM`, 代表這個 dockerfile 用了兩個 stage 下去操作\
第一部份 `builder_stage` 主要是作 compile 的部份\
而重點來囉，***第二部份 final_stage 它從 builder_stage 直接複製 echo server 的 binary 資料！***\
所以 multi-stage build 的重點就在這，它可以只留下最重要的部份，不只 source code 我連第三方 package 的依賴都可以拔掉

讓我們來檢查一下他的 layer 吧
{% raw %}
```shell
$ docker image inspect --format "{{json .RootFS.Layers}}" echo-multi-stage-optimized
[
  "sha256:ded7a220bb058e28ee3254fbba04ca90b679070424424761a53a043b93b612bf",
  "sha256:64394d25bf3e8126f87c418023130624fc841dfe79f3c88a6d20232196f7bad6"
]
```
可以看到它的確只有兩層(`FROM alpine:latest` 以及 `COPY --from=builder_layer /server .`)\
一樣照慣例，看一下第一層的 layer hash 是不是 alpine 的
```shell
$ docker inspect alpine:latest
        xxx

        "RootFS": {
            "Type": "layers",
            "Layers": [
                "sha256:ded7a220bb058e28ee3254fbba04ca90b679070424424761a53a043b93b612bf"
            ]
        },

        xxx
```
{% endraw %}

實驗程式碼可以參考 [ambersun1234/minimized-docker-image-lab](https://github.com/ambersun1234/minimized-docker-image-lab)

# References
+ [Docker Image Size - Does It Matter?](https://semaphoreci.com/blog/2018/03/14/docker-image-size.html)
+ [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/#use-multi-stage-builds)
+ [Best practices for writing Dockerfiles](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#minimize-the-number-of-layers)
+ [About storage drivers](https://docs.docker.com/storage/storagedriver/)
+ [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/#use-multi-stage-builds)