---
title: Kubernetes 從零開始 - 如何測試你的 Kubernetes 應用程式？
date: 2024-11-17
categories: [kubernetes]
tags: [dynamic client, client-go, clientset, unsturctured object, fake client, GVR]
description: 本文將會介紹如何使用 client-go 提供的 fake client 來進行 Kubernetes 應用程式的測試
math: true
---

# Kubernetes Application Testing
軟體工程裡面測試應用程式是一個很重要的環節，開發 Cloud Native 應用程式的時候也一樣\
常見的就是使用 Kubernetes 進行開發，建立 Pod 跑東西之類的\
所以很明顯這種邏輯也是需要進行測試覆蓋的

那問題來了\
如 PostgreSQL, Redis 等等的都可以使用一些軟體工程的方法繞過\
常見的就是建立個 `interface` 解耦，並且將其 mock 掉\
但是 Kubernetes 這種東西，你要怎麼 mock？

> 有關測試的討論，可以參考 [DevOps - 單元測試 Unit Test \| Shawn Hsu](../../devops/devops-unit-test)

# Clientset and Dynamic Client
[client-go](https://github.com/kubernetes/client-go) 是一套與 Kubernetes Cluster 進行溝通的 library\
其中最常用到的就是 [clientset](https://pkg.go.dev/k8s.io/client-go/kubernetes) 以及 [dynamic client](https://pkg.go.dev/k8s.io/client-go/dynamic)

`clientset` 主要是用來操作 Kubernetes 內建的 Resource，像是 Pod, Deployment, Service 等等\
所有的操作都是有型別定義的，所以整體操作起來是比較安全的(因為有 type check)\
但是對於非內建的 Resource，像是 Custom Resource，就沒辦法直接操作了\
這時候你需要使用 `dynamic client` 來操作\
`dynamic client` 是一個通用的 client，可以操作任何 Resource，但是操作起來就沒有 `clientset` 安全了\
所有的 Resource 都必須要轉型成 unstructed object 來操作\
本質上它只是 `map[string]any`

> 有關 CRD 的介紹可以參考 [Kubernetes 從零開始 - client-go 實操 CRD \| Shawn Hsu](../../kubernetes/kubernetes-crd)

## Unstructured Object
如果你用 [operator-sdk](https://sdk.operatorframework.io/docs/building-operators/golang/tutorial/) 建構 Custom Resource\
你會擁有一個 Resource structure 可以直接操作，client 也可以直接吃這個 structure\
透過 dynamic client 你沒辦法直接塞這個 structure 進去，你必須要轉換成 unstructured object

> 既然我有 Resource 的定義，我不能用 `clientset` 嗎？\
> 沒辦法，因為你需要將這個 Resource 註冊進去，顯然是有難度的

你可以用 `k8s.io/apimachinery/pkg/runtime` package 來進行轉換\
它提供了 `ToUnstructured` 以及 `FromUnstructured` 這兩個方法\
讓你在 Resource structure 與 unstructured object 之間進行轉換

```go
var crd fooV1.Foo
runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, &crd)

runtime.DefaultUnstructuredConverter.ToUnstructured(crd)
```

## Fake Client
所以回到重點，如果要 mock 應該從 `clientset` 以及 `dynamic client` 下手\
因為你需要透過這兩個 client 來操作 Kubernetes Cluster\
比如說建立 Pod, Deployment 等等

`fake` package 是一套讓你方便進行測試的實作\
`clientset` 以及 `dynamic client` 都有提供 fake client\
而他們都實作了各自的 interface，所以你的 service 定義的時候就會像這樣

```go
type Service struct {
	clientSet     kubernetes.Interface
	dynamicClient dynamic.Interface
}

func NewService(
    clientSet kubernetes.Interface, 
    dynamicClient dynamic.Interface,
) *Service {
	return &Service{
		clientSet:     clientSet,
		dynamicClient: dynamicClient,
	}
}
```

# Example
因為我們已經使用了 `clientset` 與 `dynamic client` 提供的 interface 進行解耦\
所以即使抽換掉實作，我們原本程式碼也不需要任何的改變，測試寫起來會很輕鬆，就像以下這樣

> 完整的實作可以參考 [ambersun1234/blog-labs/k8s-test](https://github.com/ambersun1234/blog-labs/blob/master/k8s-test)

## Clientset
```go
func TestService_CreateEmptyJob(t *testing.T) {
	sc := fake.NewSimpleClientset()
	dc := fakeDynamic.NewSimpleDynamicClient(runtime.NewScheme())

	s := NewService(sc, dc)
	require.NoError(t, s.CreateEmptyJob("test"))

	job, err := sc.BatchV1().Jobs("default").Get(context.TODO(), "test", metaV1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, "test", job.Name)
}
```

所有的操作都跟你使用真正的 clientset 一樣\
這裡我測試我的 `CreateEmptyJob` 有沒有正確建立，並使用 fake client 驗證

## Dynamic Client
```go
func TestService_CreateFoo(t *testing.T) {
	sc := fake.NewSimpleClientset()
	dc := fakeDynamic.NewSimpleDynamicClient(runtime.NewScheme())

	s := NewService(sc, dc)
	require.NoError(t, s.CreateFoo("test", "value"))

	foo, err := dc.Resource(crd.GVR).Namespace("default").Get(context.TODO(), "test", metaV1.GetOptions{})
	require.NoError(t, err)

	data, found, err := unstructured.NestedString(foo.Object, "spec", "value")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "value", data)
}
```

因為 CRD 並不被 Kubernetes 本身所認識，所以操作的時候需要提供 `GVR`\
GVR 包含了 Group, Version, Resource 這三個資訊\
以本例，就是
+ `Group`: foo.example.com
+ `Version`: v1
+ `Resource`: foos

GVR 需要對照到 CRD 本身的定義，所以可能需要微調

> 注意到 Resource 這裡需要指定複數型態

# References
+ [client-go/kubernetes](https://pkg.go.dev/k8s.io/client-go@v0.31.2/kubernetes)
+ [client-go/dynamic](https://pkg.go.dev/k8s.io/client-go@v0.31.2/dynamic)
