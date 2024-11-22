---
title: Kubernetes 從零開始 - client-go 實操 CRD
date: 2024-11-18
categories: [kubernetes]
tags: [crd, cr, dynamic client, client-go, clientset, api aggregation]
description: 本文將會介紹 CRD 的基本概念以及如何使用 client-go 來操作 Custom Resource
math: true
---

# Extend Kubernetes Resource
Kubernetes 有許多內建的 Resource，像是 Pod, Deployment, Service 等等\
但開發者的需求總是不斷的增加，有時候內建的 Resource 並不能滿足商業需求\
假設你需要表達一個很複雜的資源，現有的其實寫起來會很複雜

這時候，你可以使用 `Custom Resource (CR)` 來擴充 Kubernetes 的 Resource\
擴充這件事情本質上還是圍繞在 Kubernetes 是一個 container orchestration system 的基礎\
所有的操作都是跟 container 有直接或間接相關的，比如說 ConfigMap 允許動態的載入設定檔，不需要重新編譯 container image

CR 本身也符合這些特性，它不一定要跑 container, 它可以是一個單純的資源\
可以讓你寫入或讀取結構化的資料

## Why not just use ConfigMap or Secret?
既然它可以單純的表示一個可以讀寫的單元，很明顯內建的 ConfigMap 以及 Secret 也可以做到\
的確大多數情況下，設定檔這種東西實在沒必要用 CR 自找麻煩

## Another Abstraction Layer to Kubernetes Resource?
如果你的 Custom Resource 要執行 container\
一個問題油然而生，我要怎麼跑？

所以本質上，Custom Resource 又再封裝了一層 Kubernetes Resource\
實際上在執行的，可以是 Job, Deployment 等等內建的 Resource\
這個 Custom Resource 的設計邏輯會更貼近你的 **業務邏輯**，讓你可以更好的操作與理解

# Introduction to Custom Resource
Custom Resource 是 Kubernetes API 的 Extension\
它允許你根據不同的需求(i.e. 業務邏輯) 客製化專屬的 Resource\
這個 Resource 可以是一個單純的資料結構，也可以是一個需要執行 container 的複雜資源

> 注意到你不應該用 Custom Resource 當成是 data storage\
> 它並不是要讓你這樣用的，對效能上會有影響

你可以直接透過 `$ kubectl` 的指令來操作 Custom Resource\
並且 Custom Resource 可以被動態的創建，更新以及刪除，如同內建的 Resource 一樣方便

## State Management with Kubernetes Operator
Custom Resource 說到底還是一個 Kubernetes Resource\
因此，其 Kubernetes Object 也擁有所謂的狀態\
這些狀態的控制是透過 `Kubernetes Operator` 進行的

Custom Resource 可以自定義他的理想狀態\
常見的就是成功失敗之類的，或其實你可以定義當某個欄位變成某個數值的時候，做某件事情

有關 controller(i.e. operator) 可以參考 [Kubernetes 從零開始 - 從自幹 Controller 到理解狀態管理 \| Shawn Hsu](../../kubernetes/kubernetes-controller)

## Creating Custom Resource
為了能夠在 Kubernetes 中透過 `$ kubectl` 指令來操作 Custom Resource\
CR 本身要被定義在 Kubernetes API Server 中\
預設情況下，Kubernetes API Server 並不知道你的 Custom Resource 是什麼(所以它才叫做 Custom)

原本的 API Server 只知道內建的 Resource，像是 Pod, Deployment, Service 等等\
所以一個作法是起另一個 API Server 然後這個 API Server 知道你的 Custom Resource\
所以你有兩個 API Server，一個是原本的，一個是你自己定義的\
透過 proxy 的方式將 Custom Resource 的操作轉發到你自己的 API Server\
這稱作 `API Aggregation`

不過透過 API Aggregation 的方式會需要你懂一點 coding\
相對的，使用 `CustomResourceDefinition (CRD)` 會比較簡單\
CRD 的安裝方式並不需要額外一台 API Server 而且也不需要任何 coding 知識

||[Custom Resource Definition (CRD)](#customresourcedefinition-crd)|API Aggregation|
|:--|:--|:--|
|需要額外的 API Server|:x:|:heavy_check_mark:|
|上手難度|低|高|
|後期維護難易度|低|高|
|彈性|低|高|

## CustomResourceDefinition (CRD)
CRD 是一個內建的 Kubernetes Resource\
你可以透過 CRD 定義 Custom Resource 的 Schema\
它寫起來會長這樣

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: foos.foo.example.com
spec:
  group: foo.example.com
  names:
    kind: Foo
    listKind: FooList
    plural: foos
    singular: foo
  scope: Namespaced
  versions:
  - name: v1
    schema:
      openAPIV3Schema:
        description: Foo is the Schema for the foos API
        properties:
          apiVersion:
            type: string
          kind:
            type: string
          metadata:
            type: object
          spec:
            description: FooSpec defines the desired state of Foo
            properties:
              value:
                type: string
            type: object
          status:
            type: object
      served: true
      storage: true
      subresources:
        status: {}
```

> 可參考 [ambersun1234/blog-labs/k8s-test](https://github.com/ambersun1234/blog-labs/tree/master/k8s-test)

當你在 Kubernetes cluster 裡面建立 CRD\
它其實是建立了一個新的 Resource, 你可以透過以下的 URL 取得相對應的資源\
本例來說就是 `/apis/foo.example.com/v1/namespaces/*/foos/...`\
因為要區分不同的 Resource, 你可以看到 `Group`, `Version` 以及 `Resource` 都呈現在 URL 中(所謂的 **GVR**)

這個 CRD 本身的名字是由 Resource name + Group name 組成的\
需要注意的是 Resource name 需要使用 **複數**\
而這個名字需要符合 DNS subdomain 的規則(可參考 [DNS Subdomain Names](https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-subdomain-names))

## Installation
`$ kubectl apply -f crd.yaml`\
建立 CRD 之後你的所有 kubectl 操作都跟內建的 Resource 一樣

# CRD Cluster Role
要能夠操作 CRD 你需要一定的權限\
一般情況下你是 cluster admin 你不一定需要設定 rule 才可以操作 CRD\
對於服務來說，你需要設定一個 `ClusterRole` 來讓你的服務可以操作 CRD

Kubernetes 本身是使用 RBAC 來控制權限\
所以寫起來就是 `你有沒有權限去操作這個 Resource，你可以做什麼操作`

當然 ClusterRole 本身需要搭配 ClusterRoleBinding 以及 ServiceAccount 來使用

> `ClusterRole` 作用域是整個 cluster\
> `Role` 作用域是 namespace

```yaml
kind: ClusterRole
metadata:
  name: foo-editor-role
rules:
- apiGroups:
  - foo.example.com
  resources:
  - foos
  verbs:
  - create
  - delete
  - get
  - list
  - patch
  - update
  - watch
- apiGroups:
  - foo.example.com
  resources:
  - foos/status
  verbs:
  - get
```

> 你可以使用 `$ kubectl auth can-i get foo` 測試你有沒有權限

# CRD Example with client-go
```go
func (s *Service) CreateFoo(name, value string) error {
    foo := &crd.Foo{
        TypeMeta: metaV1.TypeMeta{
            Kind:       "Foo",
            APIVersion: "foo.example.com/v1",
        },
        ObjectMeta: metaV1.ObjectMeta{
            Name: name,
        },
        Spec: crd.FooSpec{
            Value: value,
        },
    }

    object, err := runtime.DefaultUnstructuredConverter.ToUnstructured(foo)
    if err != nil {
        return err
    }

    _, err = s.dynamicClient.Resource(crd.GVR).
        Namespace("default").
        Create(context.TODO(), &unstructured.Unstructured{Object: object}, metaV1.CreateOptions{})

    return err
}
```

> 可參考 [ambersun1234/blog-labs/k8s-test](https://github.com/ambersun1234/blog-labs/tree/master/k8s-test)

client-go 在建立 CR 的時候需要使用 `dynamic-client`\
因為 clientset 並不知道你的 Custom Resource 是什麼\
所以你需要透過 `dynamic-client` 來操作

可以參考 [Kubernetes 從零開始 - 如何測試你的 Kubernetes 應用程式？ \| Shawn Hsu](../../kubernetes/kubernetes-test)

# References
+ [Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#should-i-use-a-configmap-or-a-custom-resource)
+ [Extend the Kubernetes API with CustomResourceDefinitions](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/)
+ [Kubernetes API Aggregation Layer](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/apiserver-aggregation/)
+ [Set up an Extension API Server](https://kubernetes.io/docs/tasks/extend-kubernetes/setup-extension-api-server/)
+ [Role and ClusterRole](https://kubernetes.io/docs/reference/access-authn-authz/rbac/#role-and-clusterrole)
