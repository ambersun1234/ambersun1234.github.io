---
title: Container 技術 - 理解 Docker Container
date: 2021-09-20
description: 你已經使用 Docker 一段時間了，但是你真的了解他嗎？本文將會探討 Docker 的運作原理
categories: [container]
tags: [docker, linux]
math: true
---

# Virtualization
Docker 身為一個容器化技術的代表，與傳統 virtual machine 不同\
Docker 擁有更快的啟動速度、對系統資源的極低要求以及輕量化的優點，既然同為 `虛擬化技術`，那麼他與傳統的 virtual machine 又有甚麼不一樣的地方呢?

傳統的虛擬機器如 [virtual box](https://www.virtualbox.org/), [vmware](https://www.vmware.com/tw.html)，他們皆屬於一個完整的 `作業系統`，亦即他擁有獨立的 kernel space 以及 user space\
若讀者有曾經使用過上述兩套軟體就可以發現，在建立環境的時候需要準備 [disk image](https://en.wikipedia.org/wiki/Disk_image) 並且如同一般安裝作業系統的方式安裝\
也正是如此，所以跑虛擬機器會耗費大量的系統資源，如果說你的本機環境硬體設備不夠力，時常開一個 vm 就會很吃力了

看到這你可能會想說 甚麼? Docker 不是一個完整的作業系統?\
對! Docker 本質上不是一個作業系統，而是一組 `process`\
也就是說，Docker Container 是屬於一個 OS-level 的 user-space process\
而 container 與 host machine 共享同一個 kernel

![](https://www.docker.com/wp-content/uploads/2022/12/containers-and-vms-together-1.png.webp)
> ref: [Containers and VMs Together](https://www.docker.com/blog/containers-and-vms-together/)

<hr>
在這裡做一個小小的表格比較一下

||container|virtual machine|
|:--:|:--|:--|
|本質|process|operating system|
|大小|輕量|較為笨重|
|開起速度|快|慢|
|可執行個體數量|多|少|

# How does Docker work
既然 Container 只是一組 process

+ 那為甚麼使用如 `$ ps` 之類的指令能看到的進程數量異常稀少呢?
  + Linux kernel 提供了一個 [namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html) system call，他可以限制一個 process 能夠看到的範圍。有了這個東西之後，做到基本的 `隔離` 就不成問題了
+ 為甚麼用起來感覺跟用一個完整的作業系統沒有甚麼不同呢?
  + 當我們在使用 `$ docker run` 的時候系統會將 [base image](https://docs.docker.com/develop/develop-images/baseimages/) (或是由 `$ docker build` 建起來的客製化 image) 藉由 container runtime 跑起來變成一個真正的服務。而 image 裡面包含了一個作業系統的檔案系統目錄結構，並且搭配 [chroot](https://man7.org/linux/man-pages/man2/chroot.2.html) system call 改變當前執行環境目錄，用以達到讓你身處於一個作業系統之中的錯覺

> 可參考 [Linux Kernel - namespaces](../../linux/linux-namespaces)\
> 可參考 [Container and Layers](#container-and-layers)

藉由使用 Linux Kernel 提供的 system call，我們可以很容易地建立一個類似於 Docker 的虛擬環境

# Container and Layers
![](https://docs.docker.com/storage/storagedriver/images/sharing-layers.webp?w=600&h=300)
> ref: [Container and Layers](https://docs.docker.com/storage/storagedriver/#container-and-layers)

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
![](https://docs.docker.com/build/guide/images/layers.png)

那我就好奇了\
單純的減少層數，能夠縮減多少？\
考慮以下實作程式碼
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

實驗程式碼可以參考 [ambersun1234/blog-labs/minimized-docker-image-lab](https://github.com/ambersun1234/blog-labs/tree/master/minimized-docker-image-lab)

# Docker Networking
得益於優異的網路設定，其他服務可以很輕鬆的與 container 連接, 不須理會他是跑在哪一個 OS 上面，更甚至不用知道他是不是 container\
接下來就看看，要如何設定網路吧

## Bridge Network
顧名思義，就像是一座橋樑，連接著 host kernel 與 container\
它可以是 software bridge 或是 hardware bridge(以 docker 來說當然是 software bridge)

預設的情況下，如果你沒有指定，container 預設將連接至 bridge network\
default bridge network 下，container 要互相連接僅能依靠 `ip address`\
並且，所有連接到 default bridge network 的 container 都能夠互相溝通，這其實不太好\
我們不希望不相干的 service 有任何互相存取的可能性

### User-defined Bridge Network
使用自定義的 bridge network 能夠手動的控制有哪些 container 可以加到這個網路\
在安全性上會比較好\
並且容器的相互溝通，可以使用 container name!

手動建立一個 bridge network
```shell
$ docker network create testBridge
7f8836b042f9398d3a48a3bd8e2e86b6306dfdb63c41b8e906970d7eff829f8a
```

建立一個 container 並使用前面定義的 bridge network
```shell
$ docker run -itd --network testBridge --name testContainer ubuntu
```

查看它是否使用我們定義的 network
```shell
$ docker inspect testContainer

            "Networks": {
                "testBridge": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "fc6a85559a10"
                    ],
                    "NetworkID": "7f8836b042f9398d3a48a3bd8e2e86b6306dfdb63c41b8e906970d7eff829f8a",
                    "EndpointID": "0d3255316f378ff5ce7c6abc7c101598c036c4812326d5d498ecf8a11eee2700",
                    "Gateway": "172.19.0.1",
                    "IPAddress": "172.19.0.2",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "MacAddress": "02:42:ac:13:00:02",
                    "DriverOpts": null
                }
            }

```

可以看到在 `NetworkID` 的部份是一樣的

## Overlay Network
![](https://ithelp.ithome.com.tw/upload/images/20171225/20103456nk2xTDWgQk.png)
> ref: [Day22：介紹 Docker 的 Network (三)](https://ithelp.ithome.com.tw/articles/10193708)

overlay network 允許 docker 連接不同 cluster 上的 docker container

## Host Network
host network 的狀況下，container 的 network 設定將與 host machine 一致，也就是說你不需要 export port 就可以直接使用\
這個模式下 container 將不會有自己的 ip

```shell
$ docker run -itd --network host --name testContainer ubuntu
```

## Disable Network
將 network 設定為 `none` 即可關閉網路

```shell
$ docker run -itd --network none --name testContainer ubuntu
```

# Reference
+ [Containers From Scratch • Liz Rice • GOTO 2018](https://www.youtube.com/watch?v=8fi7uSYlOdc&t=1543s)
+ [Mastering the Docker networking](https://dev.to/leandronsp/mastering-the-docker-networking-2h57)
+ [Networking overview](https://docs.docker.com/network/)
