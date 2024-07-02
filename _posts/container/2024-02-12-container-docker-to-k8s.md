---
title: Container 技術 - 從 Docker 到 Kubernetes，你能獲得什麼？
date: 2024-02-12
categories: [container]
description: 雖然 Kubernetes 能夠帶來很多好處，但是你真的需要用到那麼複雜的工具嗎？ 用其他的工具是不是也能做到 Load Balance 與 Auto Scale 呢？
tags: [container, docker, k8s, scale, nginx, proxy, load balance, fault tolerance, reverse proxy, docker swarm]
math: true
---

# Preface
人家都在說，Kubernetes(俗稱 k8s) 是一個容器集群管理的工具\
當你要管理一大群的 container 的時候，使用 k8s 是一個不錯的選擇

但我們仔細回想一下 k8s 能帶來的好處\
無非就是以下幾點
1. 能夠自動擴展(auto scale out/up)
2. 能夠自動偵測故障並復原(self healing)
3. 擁有 load balance 的功能

我滿好奇的，現有的工具難道做不到嗎\
在正式學習 k8s 之前，我們應該要先審視手上的工具\
新工具不會是萬能的，你也許聽過 k8s 在小團隊使用會造成一定的困難，尤其是團隊成員都對該工具不熟悉的時候

# Production Environment Features Recap
我們上面提到的那些功能，基本上都是屬於正式環境才可能需要面對的東西\
亦即開發中，你應該不需要處理這些管理的部份\
但是讓我們稍微複習，或者是重新認識一下這些術語

## Auto Scaling
在 [資料庫 - 初探分散式資料庫 \| Shawn Hsu](../../database/database-optimization-hardware) 中我們有提到 scale up 以及 scale out 的概念\
但是你會希望這些操作可以是自動化的執行\
也就是說當系統偵測到目前的流量以現有的系統已經無法支撐的情況之下，它能夠自己新增機器\
以及，當流量下降的時候，它能夠關掉一些資源避免系統的浪費

## Load Balancing
![](https://media.geeksforgeeks.org/wp-content/cdn-uploads/20201030211002/Load-Balancer-System-Design.png)
> ref: [Load Balancing Approach in Distributed System](https://www.geeksforgeeks.org/load-balancing-approach-in-distributed-system/)

負載平衡是一種常見的增加伺服器吞吐能力的手段\
他的假設是你的應用程式部屬在 **多台機器** 上\
你不會希望只有其中一台伺服器很忙而已

因此負載平衡會將大量的 request 盡量均勻的分佈在所有 worker(機器) 上面\
當新的機器加入的時候([Auto Scaling](#auto-scaling))，它也能夠分攤現有的工作量，使得吞吐量得以提昇

## Fault Tolerance and Self Healing
基本上正式環境，不敢說全部，但大多數可能都會遇到服務掛掉的情況\
那你要怎麼即時的去反應這些問題，怎麼去解決就成了一個大的問題\
有的問題可能重開就好，但有的可能沒有那麼好處理

一樣的概念，如果能將某些部份自動化處理，是不是也能夠減少服務掛點對使用者的影響\
自動偵測並復原顯得相對重要了

包括最基本的重開機，資料的復原等等的都是包含在裡面的\
服務重啟的過程，是不是會斷線？ 要盡量避免服務中斷也是很重要的一點

# Nginx
我最早碰 [Nginx](https://www.nginx.com/) 的時候，是僅僅用它最為我的 web server 而已\
而它其實能做的更多，包含我們談到的 [Load Balancing](#load-balancing) 以及本篇的隱藏知識, proxy

## Proxy
Proxy 就一句話，服務於 client 以及 server 中間的東西

你可以用網頁後端的 middleware 來思考，它長得很像\
同樣都是服務於 client server 之間\
但是 proxy 是負責全部的流量，而 middleware(網頁) 只有負責該次 request/response

## Forward Proxy vs. Reverse Proxy
Nginx 可以幫你加一些 header 之類的，根據 [Module ngx_http_proxy_module - proxy_set_header](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header)\
預設會幫你加 `Host` 以及 `Connection`

而這個是屬於 **Forward Proxy**，亦是 `多個 client 到 單一 server`
![](https://www.jyt0532.com/public/forward-proxy.png)
> ref: [系統設計 - 正向代理跟反向代理](https://www.jyt0532.com/2019/11/18/proxy-reverse-proxy/)

<hr>

![](https://www.jyt0532.com/public/reverse-proxy.png)
> ref: [系統設計 - 正向代理跟反向代理](https://www.jyt0532.com/2019/11/18/proxy-reverse-proxy/)

反向代理則是 `單一 client 到 多個 server`\
其中這很有用的地方是我們說過得 [Load Balancing](#load-balancing)\
你可以決定要將 request 導向哪一個 server

根據 [HTTP Load Balancing](https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/)\
Nginx 預設的演算法是 `Round Robin`
> By default, NGINX distributes requests among the servers in the group according to their weights using the Round Robin method. The weight parameter to the server directive sets the weight of a server; the default is 1

寫起來大概長這樣
```json
upstream backend {
    server backend1.example.com weight=5;
    server backend2.example.com;
    server 192.0.0.1 backup;
}
```
不用擔心後面我們會實際的操作一下

## Sticky Session
執行 load balancing 如果碰到 session 這種東西可能會有一點麻煩\
假設你的 session 是儲存在 server 本身的，那問題可大了

多台的機器做 load balancing 意味著你下一次 request 到後端，可能是不一樣的 server 在服務\
此時，server B 並沒有你在 server A 上面註冊的 session\
因此你可能會遇到一些存取的問題

這個時候你會希望，client A 永遠是由 server A 服務，並不會由其他伺服器接手\
所以 sticky session 的用意就是這個

同時 Nginx 也在 Plus 的服務中提供相關服務，可參考以下文件 [Enabling Session Persistence](https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/#enabling-session-persistence)

# Docker Compose
docker-compose 算是老朋友了，從一開始我在學習使用 docker 架設網站的時候就碰過了\
那麼，它能夠滿足我們提到的三個需求嗎(load balance, auto-scaling 以及 fault tolerance and self healing)

其實我們前面就給過提示了\
使用 docker-compose 某種程度上可以達成以上要求\
讓我們看個例子

```yaml
version: "3.9"

services:
  web:
    build: .
    deploy:
      replicas: 5
      restart_policy:
        condition: on-failure

  nginx:
    image: nginx:latest
    ports:
      - "8080:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - web
```

這個 deployment 有兩個 service, 分別是 web 以及 nginx\
其中 web 只是一個簡單的 express echo server\
它擁有 5 個 replica 以及設定好的 restart policy

這代表著他有一定的復原的能力，雖然僅僅是在失敗的時候重啟而已\
5 個 replica 則表示其具有一定能力可以負擔更大的 request 數量\
但是要怎麼讓它均勻的讓每個 server 執行呢？

前面提到 nginx 可以實現負載平衡\
但是！ 以這個例子 實現負載平衡的卻不是 nginx\
我們有 5 個 replica, 每一次呼叫的時候，你怎麼會知道呼叫的是哪一台 server 呢？

docker 有自己內建的 dns server, 這也解釋了為什麼我們可以單純的使用 **"名字"** 來設定 ip\
因為底層會幫我們把那個名字透過 dns server 轉換成真實的 ip address\
而你每一次呼叫 "web" service 的時候，dns server 都要決定要給你哪一個 ip 對吧\
所以負載平衡這段其實是由 docker 內建的 dns server 幫你做掉了

> 有關 DNS load balancing\
> 可參考 [重新認識網路 - 從基礎開始 \| Shawn Hsu](../../network/networking-basics)

你說可是上面我們還是使用了 nginx 阿\
那是因為每一個 replica service 都使用了相同的 port number(這個會造成 error), 我們需要一個統一的進入點存取\
所以這裡才使用了 nginx

```
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        
        location / {
            proxy_pass http://web:3000;
        }
    }
}
```

因為每一個 replica service 都聽 3000 port，所以 dns server 會自動將 web 轉換掉變成真正的 ip address\
所以我們才可以這樣寫

# Docker Swarm

# References
+ ['docker-compose' creating multiple instances for the same image](https://stackoverflow.com/questions/39663096/docker-compose-creating-multiple-instances-for-the-same-image)
+ [系統設計 - 正向代理跟反向代理](https://www.jyt0532.com/2019/11/18/proxy-reverse-proxy/)
+ [Nginx的负载均衡 - 最少连接 (least_conn)](https://blog.csdn.net/zhangskd/article/details/50242241)
