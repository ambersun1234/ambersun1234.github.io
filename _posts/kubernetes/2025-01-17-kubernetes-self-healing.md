---
title: Kubernetes 從零開始 - Self Healing 是如何運作的
date: 2025-01-17
categories: [kubernetes]
tags: [probe, liveness probe, readiness probe, startup probe, gRPC, TCP, EXEC, health check, healthz, controller, operator, self healing, self-healing, kubelet]
description: 自動修復是 Kubernetes 的一大功能，但你可曾思考過他是如何運作的嗎？ 本文將會介紹 Kubernetes 中的探測棒(Probe)以及自動修復的機制
math: true
---

# Application Status
在 Kubernetes 中，一個應用程式的狀態是非常重要的\
當一個應用程式不可用，造成的損失是巨大的

應用程式可能因為多種原因而失效，比如說程式碼的 bug, 硬體故障等等\
當應用程式失效的時候，我們希望可以透過某種方式知道它目前的狀態\
進而採取必要的措施來修復它

# How Kubernetes Knows Application is Down
Kubernetes 有一個強大的機制是可以自動檢測並修復應用程式，這個機制稱之為 `Self-Healing`\
但 Kubernetes 沒辦法主動知道你的應用程式狀態，因為每個 app 的狀態都不盡相同\
它沒辦法用一個通用的方式來判斷一個 app 是否正常運作

以 web application 來說，我們可以利用 HTTP request 作為驗證狀態的一種方式\
比方說我可以設定一個 `/healthz` 的 endpoint，當 user 有辦法訪問以及他有回傳結果的時候\
我們就可以認為這個 app 是正常運作的

那 `/healthz` 這個 endpoint 具體來說需要做什麼？\
基本上，取決於不同的應用程式 **對於正常運作的定義** 是什麼\
一般來說，只要回傳 200 OK 就可以了

# Introduction to Probes
<img src="https://i5.walmartimages.com/asr/0675cf2a-86d9-4932-9773-64233eb1558a.0e62b6e978fcc96fe7588ed245eef58b.jpeg?odnHeight=2000&odnWidth=2000&odnBg=FFFFFF" width="600" height="100">

> ref: [Grain Probe Sampler Corn Sampler Broomcorn Sampler Reusable Grain Sampler](https://www.walmart.com/ip/Grain-Probe-Sampler-Corn-Sampler-Broomcorn-Sampler-Reusable-Grain-Sampler/6040305129)

在 Kubernetes 中，我們可以透過 `Probe` 來檢測應用程式的狀態\
如上圖，Probe 就是一個探測棒。因為整個應用程式的範圍太大了，你沒辦法完全驗證全部的狀態\
透過玉米探測棒，將它插進去存放穀物的糧倉桶內，透過檢視部份狀態來推算整體穀物的好壞

如上面我們討論的部份\
我們可以設計 `/healthz` 作為簡易探測棒，用以推測整個應用程式的狀態

## Types of Probes
探針擁有不同的類型，針對不同的場合使用

### Liveness Probe
我們最常用的就是 `Liveness Probe`\
判斷一個應用程式是不是 *還活著*，如果 liveness 失敗 Kubernetes 會嘗試重新啟動它

注意到如果你沒有將它設定好，你可能會遇到不可預期的行為\
比方說，我之前在 debug 的時候會發現 pod 會沒有原因的重啟，原因在於 Liveness Probe 的 endpoint 寫錯\
而這個重啟看起來是有規律的\
看 log 你是看不出來有什麼問題，但是在 `$ kubectl describe pod` 裡面就可以看到詳細原因

### Readiness Probe
與 [Liveness Probe](#liveness-probe) 不同，`Readiness Probe` 是用來判斷一個應用程式是否 *ready*\
應用程式可能會有一些 bootstrap 的 task 需要執行\
比如說我最近做的專案中，在 service 啟動之後我必須要檢查 `在上一次退出，執行到一半的任務`\
如果有，必須要將它完成

針對這種情況，如果它必須要等待才能開始服務，那麼 Readiness Probe 就是一個很好的選擇

### Startup Probe
有時候 container 就是會啟的很慢，如果有設定 [Liveness Probe](#liveness-probe) 或 [Readiness Probe](#readiness-probe)，Kubernetes 會一直重啟\
這並不是我們想要的

`Startup Probe` 可以確保 container 啟動之後再去檢查 liveness 或 readiness\
就可以避免服務一直被重啟的問題，確保服務可以正常運作

> 注意到 Startup Probe 僅僅只是 "暫停" Liveness/Readiness Probe 的檢查直到啟動成功

<hr>

|Types of Probe|Goal|Periodically Check|
|:--|--:|--:|
|[Liveness Probe](#liveness-probe)|是否存活|:heavy_check_mark:|
|[Readiness Probe](#readiness-probe)|是否準備完成|:heavy_check_mark:|
|[Startup Probe](#startup-probe)|是否啟動|:x:|

## Probe Besides HTTP
`/healthz` 對於基本的 web application 來說是足夠的\
而且官方也說明，針對 [Liveness Probe](#liveness-probe) 以及 [Readiness Probe](#readiness-probe) 這種探針\
撰寫 low cost 的 endpoint 是比較好的 practice\
兩種 probe 可以共用同一個 endpoint，不過設計上記得 Readiness 他的 `failureThreshold` 需要比較高(避免被直接 kill 掉)

但是針對比如說 gRPC 這種非 HTTP 的應用程式，你就沒辦法使用 HTTP request 來檢測了\
因此，Kubernetes 也有提供 [gRPC](#grpc-probe), [TCP](#tcp-probe) 以及 [EXEC](#exec-probe) 的探測方式

### gRPC Probe
`gRPC` 的 probe, 與 HTTP probe 類似，你一樣需要定義一個 endpoint 來檢測(可以參考 [GRPC Health Checking Protocol](https://github.com/grpc/grpc/blob/master/doc/health-checking.md))\
他的定義會是
```proto
syntax = "proto3";

package grpc.health.v1;

message HealthCheckRequest {
  string service = 1;
}

message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
    SERVICE_UNKNOWN = 3;  // Used only by the Watch method.
  }
  ServingStatus status = 1;
}

service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);

  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse);
}
```

> 有關 gRPC 的介紹可以參考 [網頁程式設計三兩事 - gRPC 與 JSON-RPC \| Shawn Hsu](../../website/website-rpc)

注意到這個格式必須嚴格遵守，也就是說你沒辦法客製化 endpoint, request, response 等等的\
不過它仍然保持著一定的彈性，比如說你可以設定 request 裡面的 `service` 欄位來檢測不同的服務\
Kubernetes 是建議你將 service name 以及 probe type 結合\
就會變成例如說 `myservice-liveness` 這樣的名稱

然後你在實作的時候就可以解析這個名稱，分別回應相對應的狀態\
好處在於說你可以僅使用一個 port 就可以針對不同的服務進行探測

gRPC 判斷好壞的方式是透過 `ServingStatus` 來判斷\
只有 `SERVING` 才會被視為成功

### TCP Probe
針對 `TCP` 的 probe, Kubernetes 會嘗試在該 port 開一個 socket 連線，如果可以就代表成功

```yaml
livenessProbe:
  tcpSocket:
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 10
```

### Exec Probe
你也可以執行一段指令，然後看他的回傳值來判定

```yaml
livenessProbe:
  exec:
    command:
    - cat
    - /tmp/healthy
  initialDelaySeconds: 5
  periodSeconds: 5
```

比如說你可以將狀態寫進去 `/tmp/healthy`，然後透過 `cat` 來讀取\
如果回傳 0 就代表成功，否則就是失敗

執行 exec probe 需要特別注意的是，他的每次執行都是 fork process 來執行的\
如果定期執行的間隔過短會額外增加系統負擔

## Should you Define a Probe?
原則上還是會建議讓 Kubernetes 處理自動修復的部份\
盡量減少人為地介入可以避免一些不必要的問題

那這就會引到一個問題，如果我沒有定義 Probe 會怎樣？\
其實也不會怎麼樣，Kubernetes 並不會因此就瘋狂重啟你的 pod\
他的預設就都會是 success

## How to Write and Define a Probe
前面我們說過，你可以簡單定義一個 `/healthz` endpoint 來作為探測棒\
但你有沒有想過，Kubernetes 是如何判斷這個 endpoint 是成功還是失敗的？

根據 [Liveness/Readiness Probes should treat any 2XX status as healthy](https://github.com/kubernetes/kubernetes/issues/54082) 提到，所有 `2XX` 的 status code 都會被視為成功\
也就是不一定要是 200 OK, 204 No Content 也是可以的

不過有意思的是，`3XX` 系列也是會被視為成功的\
根據 [kubernetes/pkg/probe/http/http.go](https://github.com/kubernetes/kubernetes/blob/master/pkg/probe/http/http.go#L111)
```go
if res.StatusCode >= http.StatusOK && res.StatusCode < http.StatusBadRequest {
    if res.StatusCode >= http.StatusMultipleChoices { // Redirect
        klog.V(4).Infof("Probe terminated redirects for %s, Response: %v", url.String(), *res)
        return probe.Warning, fmt.Sprintf("Probe terminated redirects, Response body: %v", body), nil
    }
    klog.V(4).Infof("Probe succeeded for %s, Response: %v", url.String(), *res)
    return probe.Success, body, nil
}
```
可以看到只是會 warning 而已，問題不大

然後你就可以在，比方說 deployment 裡面定義
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8081
  initialDelaySeconds: 3
  periodSeconds: 3
  timeoutSeconds: 1
  failureThreshold: 3
```

## Can Probe Detect Hardware Failure?
是可以的，因為硬體故障通常會導致應用程式無法正常運作\
即使是網路故障導致節點沒有回應，Kubernetes 依然會自動修復，將 application schedule 到可以正常運作的節點上

# Who does the Self Healing?
## Kubelet
撇除 replica 這種需要 controller 介入的情況，Kubernetes 本身是依靠 `Kubelet` 來做到自動修復的\
kubelet 可以把他想像成節點的管理者，負責管理比如說，節點的狀態，pod 的狀態等等的

當一個 container 已經不健康的時候(使用 [Liveness Probe](#liveness-probe) 來判斷)\
kubelet 就會 **根據 RestartPolicy**, 重新啟動這個 container(or not)

那如果 [Readiness Probe](#readiness-probe) 失敗呢？\
Readiness 表示是否準備好了對吧，對於 Kubernetes 來說如果還沒準備好它就不能被 route 到上面對吧\
也就是說，Load Balancer 並不會將流量導到這個 pod

但假設你需要把 pod 關掉，停掉所有的 incoming traffic\
你不見得會需要 readiness probe，因為當它被停止的時候狀態會是 `unready`\
pod 會等到 container 內部完全停止之後才會被刪除

## Kubernetes Controller
有了 Probe 其實還不夠，因為它只是通知你說 pod 掛掉之類的\
針對 deployment 這種需要保持一定數量的 pod 運作的情況，我們需要一個 controller 來幫我們自動修復

早期 Kubernetes 是透過 [ReplicationController](https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/) 來做到動態調整 pod 數量這件事情\
將 Probe 與 Controller 相結合，就可以做到自動修復的功能

> 有關 Controller 可以參考 [Kubernetes 從零開始 - 從自幹 Controller 到理解狀態管理 \| Shawn Hsu](../../kubernetes/kubernetes-controller/)

# References
+ [ReplicationController](https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/)
+ [Liveness, Readiness, and Startup Probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)
+ [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
+ [Liveness/Readiness Probes should treat any 2XX status as healthy](https://github.com/kubernetes/kubernetes/issues/54082)
+ [Container probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)
