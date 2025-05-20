---
title: Kubernetes 從零開始 - client-go 實操 CRD
date: 2024-11-18
categories: [kubernetes]
tags: [crd, cr, dynamic client, client-go, clientset, api aggregation, custom resource definition, custom resource, crd migration, crd versioning, conversion webhook, clusterrole, role, tls, webhook, conversion, migration]
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

> 可參考 [ambersun1234/blog-labs/k8s-crd](https://github.com/ambersun1234/blog-labs/tree/master/k8s-crd) 以及 [ambersun1234/blog-labs/k8s-controller](https://github.com/ambersun1234/blog-labs/tree/master/k8s-controller)

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

## CRD Cluster Role
要能夠操作 CRD 你需要一定的權限\
一般情況下你是 cluster admin 你不一定需要設定 rule 才可以操作 CRD\
對於服務來說，你需要設定一個 `ClusterRole` 來讓你的服務可以操作 CRD

Kubernetes 本身是使用 RBAC 來控制權限\
所以寫起來就是 `你有沒有權限去操作這個 Resource，你可以做什麼操作`

> 有關 RBAC 可以參考 [網頁程式設計三兩事 - 基礎權限管理 RBAC, ABAC 與 PBAC \| Shawn Hsu](../../website/website-permission)

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

## CRD Example with client-go
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

> 可參考 [ambersun1234/blog-labs/k8s-crd](https://github.com/ambersun1234/blog-labs/tree/master/k8s-crd)

client-go 在建立 CR 的時候需要使用 `dynamic-client`\
因為 clientset 並不知道你的 Custom Resource 是什麼\
所以你需要透過 `dynamic-client` 來操作

可以參考 [Kubernetes 從零開始 - 如何測試你的 Kubernetes 應用程式？ \| Shawn Hsu](../../kubernetes/kubernetes-test)

# Custom Resource Versioning
你知道 Custom Resource 也可以迭代的嗎？\
事實上這個設計非常的合理，因為你的業務需求可能會隨著時間而改變，所以你的 Custom Resource 也可能需要跟著改變\
比方說刪減欄位，更新資料結構等等

對於這種需要 Migration 的情況，Kubernetes 本身有很好的機制負責處理\
要進行升級首先你會遇到的問題就是 `相容性`，如果你有客製化 Kubernetes Controller，你就必須要確保它能夠正確的處理新舊版本的資料\
怎麼相容呢？ 你就需要使用 [Conversion Webhook](#conversion-webhook) 來處理

> 注意到，你不應該去直接修改已經發布的 Custom Resource\
> 比如說 v1 CRD 需要升級到 v2, 你應該在 CRD 裡面額外定義一個 v2 的 schema\
> 而不是直接修改

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  annotations:
    controller-gen.kubebuilder.io/version: v0.14.0
  name: foos.foo.example.com
spec:
  group: foo.example.com
  versions:
  - name: v1
    # Each version can be enabled/disabled by Served flag.
    served: true
    # One and only one version must be marked as the storage version.
    storage: false
    # This indicates the v1alpha1 version of the custom resource is deprecated.
    # API requests to this version receive a warning header in the server response.
    deprecated: true
    # This overrides the default warning returned to API clients making v1alpha1 API requests.
    deprecationWarning: "foo.example.com/v1 is deprecated"
    # A schema is required
    schema:
      openAPIV3Schema:
        properties:
          spec:
            description: FooSpec defines the desired state of Foo
            properties:
              value:
                type: string
            type: object
  - name: v2
    served: true
    storage: true
    schema:
    openAPIV3Schema:
      properties:
        spec:
          description: FooSpec defines the desired state of Foo
          properties:
            anotherValue:
              type: string
            value:
              type: string
          type: object 
  # The conversion section is introduced in Kubernetes 1.13+ with a default value of
  # None conversion (strategy sub-field set to None).
  conversion:
    # None conversion assumes the same schema for all versions and only sets the apiVersion
    # field of custom resources to the proper value
    strategy: None
    strategy: Webhook
    webhook:
      # conversionReviewVersions indicates what ConversionReview versions are understood/preferred by the webhook.
      # The first version in the list understood by the API server is sent to the webhook.
      # The webhook must respond with a ConversionReview object in the same version it received.
      conversionReviewVersions: ["v1"]
      clientConfig:
        url: "https://my-webhook.example.com:9443/my-webhook-path"
```

比如說上述 CRD 裡面包含兩種版本 v1, v2\
其中比較需要注意的是 `served` 以及 `storage`
+ `served` 代表這個版本是否可以被服務，如果你不想兼容這個版本，你可以將 `served` 設為 `false`
    + 升級不支援的 CR 你可以手動更新或者是使用 [Version Migrator](https://github.com/kubernetes-sigs/kube-storage-version-migrator)
    + 如果不再支援，可以考慮從 CRD 拔掉這個版本
+ `storage` 則代表在底層中(i.e. [etcd](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/))，針對這個 CR 要儲存哪個版本的格式
    + 注意到已經存在的舊版本的 CR ***並不會被轉換成新版本的格式***
    + 只有當你新建立或者更新的時候才會寫入新版本的格式
    + 儲存的版本只能選一個

> 如果你是透過 Operator-SDK 建立 CRD\
> 多版本的 CRD 定義裡面需要新增 `//+kubebuilder:storageversion` 這個註解\
> 告訴 Operator-SDK 這個版本是用來儲存的

## Version Convention
在設計不同版本的 CRD 的時候，版本號的規則在這裡有點不同\
比方說你要從 `v1` 升級到 `v1.1` 之類的，這件事情是不被允許的

```shell
Invalid value: "v1.1": a DNS-1035 label must consist of lower case alphanumeric characters or '-', 
start with an alphabetic character, and end with an alphanumeric character 
(e.g. 'my-name',  or 'abc-123', regex used for validation is '[a-z]([-a-z0-9]*[a-z0-9])?')
```

而根據 [Versions in CustomResourceDefinitions](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definition-versioning/) 裡面的說明\
一個合法且常見的做法為 `stability level` + `version number`\
也就是組成類似 `v1alpha1`, `v1beta1`, `v1` 這樣的格式

## Conversion Webhook
注意到上面 CRD 裡面有一個 `conversion` 的欄位\
這是讓你拿來處理新舊版本資料格式轉換的地方

> conversionReviewVersions 是要被轉換的版本\
> 為什麼不用指定 target version 呢？ 因為同一個 CR 底層只能存一種版本的資料

你可以指定不同的策略來處理轉換
1. `None`: 不轉換，那它會長怎麼樣？
    + 具體來說，它只會更新 `apiVersion` 欄位，如果遇到它不認識的欄位，它會把它刪掉
    + 實務上當然是不推薦這個作法就是
2. `Webhook`: 透過 webhook 來處理轉換

如果要轉換\
我第一個問題會是，那我的 CR 哪時後會被轉換？\
它跟上一節講的 `storage` 有關係\
由於一個 CR 它底層儲存的資料格式只會是眾多版本中的一個
+ 讀取的時候: 底層一樣存 **舊版的格式**，給你的是 **新版的格式**
+ 寫入以及更新的時候: 寫入的就會是 **新版的格式**
+ 刪除就不用考慮格式的問題了

### How to Do the Conversion?
其實這比我想像的還滿簡單，就是寫一個 endpoint 負責處理轉換邏輯\
這個 endpoint 需要定義成 `POST` 方法，然後從 body 讀取 payload

這個 payload 長這樣\
其中 `objects` 就是需要被轉換的 CR 們\
`uid` 為唯一識別符號
```json
{
  "apiVersion": "apiextensions.k8s.io/v1",
  "kind": "ConversionReview",
  "request": {
    "uid": "705ab4f5-6393-11e8-b7cc-42010a800002",
    "desiredAPIVersion": "example.com/v1",
    
    "objects": [
      {
        "kind": "CronTab",
        "apiVersion": "example.com/v1beta1",
        "metadata": {
          "creationTimestamp": "2019-09-04T14:03:02Z",
          "name": "local-crontab",
          "namespace": "default",
          "resourceVersion": "143",
          "uid": "3415a7fc-162b-4300-b5da-fd6083580d66"
        },
        "hostPort": "localhost:1234"
      },
      {
        "kind": "CronTab",
        "apiVersion": "example.com/v1beta1",
        "metadata": {
          "creationTimestamp": "2019-09-03T13:02:01Z",
          "name": "remote-crontab",
          "resourceVersion": "12893",
          "uid": "359a83ec-b575-460d-b553-d859cedde8a0"
        },
        "hostPort": "example.com:2345"
      }
    ]
  }
}
```

轉換成功的 response 長這樣\
可以看到 `uid` 必須要長一樣，都是 `705ab4f5-6393-11e8-b7cc-42010a800002`\
然後必須要回傳 `result` object 表示成功與否

`convertedObjects` 就是轉換後的 CR 們\
你可以看到相比原本的 CR, 不只 `apiVersion` 變了, 其餘欄位也被轉換了

注意到\
`metadata` 裡面的東西基本上都是不能動的(除了 `label` 以及 `annotation`)\
因為這些資料一旦遺失，Kubernetes 就不知道這個 CR 是誰了
```json
{
  "apiVersion": "apiextensions.k8s.io/v1",
  "kind": "ConversionReview",
  "response": {
    "uid": "705ab4f5-6393-11e8-b7cc-42010a800002",
    "result": {
      "status": "Success"
    },
    "convertedObjects": [
      {
        "kind": "CronTab",
        "apiVersion": "example.com/v1",
        "metadata": {
          "creationTimestamp": "2019-09-04T14:03:02Z",
          "name": "local-crontab",
          "namespace": "default",
          "resourceVersion": "143",
          "uid": "3415a7fc-162b-4300-b5da-fd6083580d66"
        },
        "host": "localhost",
        "port": "1234"
      },
      {
        "kind": "CronTab",
        "apiVersion": "example.com/v1",
        "metadata": {
          "creationTimestamp": "2019-09-03T13:02:01Z",
          "name": "remote-crontab",
          "resourceVersion": "12893",
          "uid": "359a83ec-b575-460d-b553-d859cedde8a0"
        },
        "host": "example.com",
        "port": "2345"
      }
    ]
  }
}
```

如果轉換錯誤是
```json
{
  "apiVersion": "apiextensions.k8s.io/v1",
  "kind": "ConversionReview",
  "response": {
    "uid": "<value from request.uid>",
    "result": {
      "status": "Failed",
      "message": "hostPort could not be parsed into a separate host and port"
    }
  }
}
```

## Deprecation of CRD
有了多種 CRD 版本，你需要通知使用者說這個版本已經不再支援，請它不要再繼續使用\
所以你可以在 CRD 裡面設定 `deprecated` 以及 `deprecationWarning`

```yaml
  versions:
  - name: v1
    schema:
      openAPIV3Schema:
        ...
    served: true
    storage: false
    deprecated: true
    deprecationWarning: foos.foo.example.com/v1 is deprecated. Use foos.foo.example.com/v2 instead.
```

> 如果你是透過 Operator-SDK 建立 CRD\
> 需要加上 `//+kubebuilder:deprecatedversion` 註記這個版本被棄用

然後你在使用的時候就可以看到警告\
注意到即使 deprecated 仍然可以使用，要把 `served` 設為 `false` (或刪除)才會真的不支援 

![](/assets/img/posts/crd1.png)

當你查看寫入 v1 的 raw yaml 的時候，可以發現到它其實是被轉換成 v2 的格式

![](/assets/img/posts/crd2.png)

> 因為我沒有定義 conversion, 所以 anotherValue 的欄位會是空的\
> value 欄位因為沒有改變，所以會被保留

## Conversion Webhook Example
<!-- 基本上就是照著 [How to Do the Conversion](#how-to-do-the-conversion) 的格式來就可以了 -->

> to be continued

# References
+ [Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#should-i-use-a-configmap-or-a-custom-resource)
+ [Extend the Kubernetes API with CustomResourceDefinitions](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/)
+ [Kubernetes API Aggregation Layer](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/apiserver-aggregation/)
+ [Set up an Extension API Server](https://kubernetes.io/docs/tasks/extend-kubernetes/setup-extension-api-server/)
+ [Role and ClusterRole](https://kubernetes.io/docs/reference/access-authn-authz/rbac/#role-and-clusterrole)
+ [Versions in CustomResourceDefinitions](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definition-versioning/#webhook-conversion)
+ [What does 'storage' means in Kubernetes CRD?](https://stackoverflow.com/questions/69558910/what-does-storage-means-in-kubernetes-crd)
+ [Managing different versions of CRD in the operator-idk controller](https://github.com/operator-framework/operator-sdk/issues/6324)
+ [Add deprecated information for API](https://github.com/kubernetes-sigs/kubebuilder/issues/2116)
