---
title: Kubernetes 從零開始 - 你的 Volume 到底 Mount 到哪裡去了？
date: 2025-11-13
categories: [kubernetes]
tags: [volume, container, mount, hostpath, local, persistent volume claim, storage class, projected volume, ephemeral volume, persistent volume, subpath, finalizers, reclaim policy, access modes, binding, use protection, dynamic provisioning, default storage class, retroactive default storage class assignment, pv, pvc, readwriteonce, readonlymany, readwritemany, readwriteoncepod]
description: Kubernetes Volume 相比 Docker 的掛載方式更為複雜，本文會帶你了解那些最常用的 Volume 以及他們的特性
math: true
---

# Introduction to Kubernetes Volume
從 Docker 的年代開始，掛載 host 的檔案系統不是什麼新鮮事\
而 mount 的方式也很直覺，直接指定 host 的檔案路徑，你就能夠在 container 裡面存取相關的資料\
到了 Kubernetes，也是有一樣的概念，但是 mount 的方式變得五花八門，相對複雜

本文將會帶你了解那些最常用的 Volume，以及他們的特性

## Quick Look to Volume
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: my-pod
spec:
  template:
    spec:
      containers:
      - name: busybox
        image: busybox
        command: ['sh', '-c', 'ls -al /mnt/data; echo "----"; ls -al /mnt/cm']
        volumeMounts:
          - mountPath: /mnt/data
            name: my-volume
            subPath: dataset1
          - mountPath: /mnt/cm/fn
            name: my-volume-cm
            subPath: firstName.txt
      volumes:
      - name: my-volume
        emptyDir: {}
      - name: my-volume-cm
        configMap:
          name: my-cm
          items:
            - key: firstName
              path: firstName.txt
      restartPolicy: Never
```

為了因應不同的情境，Kubernetes 在設計上是相對彈性的\
從上述的 Job spec 你可以看到，你需要定義這個 Pod 需要哪一些 volume(i.e. `.spec.volumes`)\
然後在裡面詳細的描述你要怎麼掛載進去要掛到哪(i.e. `.spec.containers[*].volumeMounts`)

> Pod 本身可以同時掛載 **一或多個不同的 volume**

當然這種簡單的寫法是屬於 [Ephemeral Volume](#ephemeral-volume) 的範疇\
如果使用 [Persistent Volume](#persistent-volume) 的話，你需要更複雜的定義(i.e. [Persistent Volume Claim](#how-should-you-use-persistent-volume))

## How to Mount?
但具體來說怎麼掛載，可以說，概念上與 Docker 是一模一樣的\
你需要有兩個路徑
1. Container 內部掛載路徑
    + 掛載路徑是你自己決定的，比方說 `/mnt/data`
2. Node 上的資源路徑
    + 有一個固定的路徑，規則是 `/var/lib/kubelet/pods/<pod uid>/volumes/<volume type>/<volume name>`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
  - name: my-container
    volumeMounts:
    - mountPath: /mnt/data
      name: my-volume
  volumes:
  - name: my-volume
    emptyDir: {}
```

當容器啟動的時候，container runtime 會根據以上資訊逐一進行綁定\
考慮以上 yaml，執行順序會是
1. 在 Node 上建立 `/var/lib/kubelet/pods/1234/volumes/kubernetes.io~empty-dir/my-volume`
2. container runtime 將以下進行綁定
    + `/var/lib/kubelet/pods/1234/volumes/kubernetes.io~empty-dir/my-volume` :arrow_right: `/mnt/data`
3. 啟動容器

### Precision Control with subPath
一個常見的問題是，掛載這件事情沒弄好會造成資料遺失的問題\
比方說如果你掛載到的地方本來就有資料，把它蓋過去可能東西就壞了\
又或者是你只要掛一部分的資料而已，而不是整個 volume

以上的情境催生出了 `subPath` 這個概念

#### Mount Path Obscuration
但實際上也不是蓋過去啦，是被遮蔽了\
linux 掛載有一個機制是這樣子的，當你掛載的路徑有資料，它會把原本的舊資料隱藏起來，直到你移除掛載\
這個概念也同樣適用於 Kubernetes

如果在 linux 上你可以這樣測試\
透過將 tmpfs 掛載到測試資料夾上可以很明顯的觀察到 obscuration 的效果
```shell
# 建立測試資料夾並填入測試資料
$ mkdir test
$ echo "test" > test/test.txt
$ ls -al test
total 1
drwxr-xr-x 2 root root 4096 Nov  1 10:00 .
drwxr-xr-x 4 root root 4096 Nov  1 10:00 ..
-rw-r--r-- 1 root root    4 Nov  1 10:00 test.txt
$ mountpoint test
test is a mountpoint
# 掛載 tmpfs 到 test 資料夾
$ sudo mount -t tmpfs tmpfs test
$ ls -al test
# 檔案消失了
$ mountpoint test
test is a mountpoint
# 移除掛載
$ sudo umount test
test is not a mountpoint
$ ls -al test
# 檔案又出現了
total 1
drwxr-xr-x 2 root root 4096 Nov  1 10:00 .
drwxr-xr-x 4 root root 4096 Nov  1 10:00 ..
-rw-r--r-- 1 root root    4 Nov  1 10:00 test.txt
```

> 你也可以建立一個 K8s Job 測試

系統也不會阻止你掛上去，所以這可能會造成一些問題，比方說你蓋掉了他的啟動 script\
像是掛在 `/etc` 有可能造成錯誤，`/usr` 會是比較好的選擇\
你需要足夠細心，確保原本 image 內部的資料不會被覆蓋

#### How to use subPath?
`subPath` 很好的解決了覆蓋資料以及部份掛載的問題\
考慮以下範例

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
  - name: my-container
    volumeMounts:
    - mountPath: /mnt/data
      name: my-volume
      subPath: dataset1
  volumes:
  - name: my-volume
    emptyDir: {}
```

概念上還是一樣的\
container volume 一樣會對回去 Node 上的資源路徑

原本是這樣嘛
+ `/var/lib/kubelet/pods/1234/volumes/kubernetes.io~empty-dir/my-volume`
+ `/mnt/data`

多了 `subPath` 就是新增在 Node 上的資源路徑的最後方\
所以掛載路徑會變成
+ `/var/lib/kubelet/pods/1234/volumes/kubernetes.io~empty-dir/my-volume/dataset1`
+ `/mnt/data`

注意到 `subPath` 是 ***相對於 volume root 的 相對路徑***\
你的 volume root 是 `/var/lib/kubelet/pods/1234/volumes/kubernetes.io~empty-dir/my-volume`\
mountPath 永遠指向你想要東西在哪裡可以存取到

> subPath 是加在要使用的 volume 上面，不是 mountPath

如果你掛載在 `/mnt/data/inner/myfile`\
上層的資料夾並不會被掛載進去，意思是當你改動 `/mnt/data/inner` 的資料，並不會反應回去 Node 上\
因為你只掛載了單一檔案到 container 內部

> mountPath 如果配合 subPath 使用，可以掛載單一檔案\
> 沒有指定 subPath 的時候(i.e. `subPath: ""`)，會掛載整個 volume root 到 mountPath

# Kubernetes Volume Type
不同的 [Volume Type](#volume-type) 有不同的特性\
[Ephemeral Volume](#ephemeral-volume) 的生命週期與 Pod 本身的生命週期是綁定的\
缺點在於說如果 Pod 被刪除，volume 也會被刪除\
針對需要資料持久化的情境，使用 [Persistent Volume](#persistent-volume) 會是比較好的選擇

如果你想要把所有的 volume 都掛到同一個地方，那可以參考 [Projected Volume](#projected-volume)

## Ephemeral Volume
如果這個 volume 是與 Pod 本身的生命週期綁定的，那我們稱這類 volume 為 [Ephemeral Volume](#ephemeral-volume)

Ephemeral Volume 很適合用於一些暫存的資料，這使得 Pod 可以很輕鬆的被建立以及刪除\
而不需要擔心資料持久化的問題

也因為異揮發的特性，在 Pod spec 裡面就可以完整定義 volume 的掛載方式\
而不需要仰賴其他的機制

### hostPath
如果你要做到跟 Docker volume 一模一樣的功能，Kubernetes 裡面對應到的是 `hostPath` 這個 volume\
指定 host 的路徑，他就能夠讀取到 host 的檔案\
不過，這裡的 host 是指哪裡的 host 呢？\
什麼意思，因為 Kubernetes 支援多個節點，所以本質上你的 app 有可能執行在不同的節點上\
而 `hostPath` 裡面的 host 是指定到 **節點上** 的資源路徑

不過，`hostPath` 沒有到很安全，因為你可以直接存取到 host 的檔案\
如果操作不當，可能會洩漏 system credential，甚至是能夠讓 container 存取 privileged 的 API\
有些使用情境下是可以接受的，比如說你需要讀取系統層級的 log

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-example-linux
spec:
  containers:
  - name: example-container
    image: registry.k8s.io/test-webserver
    volumeMounts:
    - mountPath: /foo
      name: example-volume
      readOnly: true
  volumes:
  - name: example-volume
    hostPath:
      path: /data/foo
      type: Directory
```

### emptyDir
如果你只是單純的需要一個暫存的空間，那可以考慮使用 `emptyDir`\
在 Pod 被建立的時候，volume 會被建立，反之被刪除的時候也會跟著一起被刪掉

所有 Pod 裡面的 container 都可以任一讀寫到這個 volume\
比方說你可以掛一個 sidecar container 來做 log 的收集與處理\
主要的 container 將 log 寫到相同的 volume 裡面

> 有關 sidecar container 可以參考 [Kubernetes 從零開始 - Sidecar 與 Lifecycle Hook 組合技 \| Shawn Hsu](../../kubernetes/kubernetes-sidecar)

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pd
spec:
  containers:
  - image: registry.k8s.io/test-webserver
    name: test-container
    volumeMounts:
    - mountPath: /cache
      name: cache-volume
  volumes:
  - name: cache-volume
    emptyDir: {}
``` 

根據節點的儲存空間，比方說 SSD 還是 HDD，預設就是會走到該媒介上面\
你可以使用 `emptyDir.medium` 額外指定使用記憶體(但注意到不能說我 SSD HDD 都有所以我想指定其中一個，這是不行的)\
以及 `emptyDir.sizeLimit` 指定 volume 的大小限制

> medium 類別
> + **""** : 預設，使用節點上的儲存空間(SSD 或是 HDD)
> + **Memory** : 使用記憶體

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pd
spec:
  containers:
  - image: registry.k8s.io/test-webserver
    name: test-container
    volumeMounts:
    - mountPath: /cache
      name: cache-volume
  volumes:
  - name: cache-volume
    emptyDir:
      sizeLimit: 500Mi
      medium: Memory
```

### configMap and secret
另一種很好用的方式是直接將外掛的參數以及資料直接掛載進 container 裡面\
在未習得這個方法之前，如果有類似的需求我都是傳 environment variable 進去\
透過 init container 掛載 [emptyDir](#emptyDir) 並寫入檔案然後主 container 掛載相同 [emptyDir](#emptyDir) 存取

但很顯然的，這種方式是有問題的\
將資料，尤其是密碼之類的透過 env 傳入是很不安全的行為\
所以原生支援掛載還是挺方便的

> 需要注意的是，無論是 `configMap` 還是 `secret`，掛載前他們都必須先被建立\
> 並且以上兩者的掛載都是 **readonly** 的

具體點來說，掛載進去容器內部的方式是以檔案為主\
你可能會想說，`secret` 也以檔案的方式掛載進去？ 不會有安全隱患嗎？\
所以其實針對 `secret` 的部份，其實是使用 [tmpfs](https://docs.kernel.org/filesystems/tmpfs.html)\
而其本身是將資料都放在 "易揮發" 的儲存空間中，確保不會有任何機會可以寫入永久儲存

> 資料放在記憶體就一定安全嗎？ 並不是\
> 只是這樣子的手段可以一定程度上降低風險

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: configmap-pod
spec:
  containers:
  - name: test
    image: busybox:1.28
    command: ['sh', '-c', 'echo "The app is running!" && tail -f /dev/null']
    volumeMounts:
      - name: config-vol
        mountPath: /etc/config
  volumes:
  - name: config-vol
    configMap:
      name: log-config
      items:
        - key: log_level
          path: log_level.conf
```

以上的例子是只有將一部分的 configMap 掛載進入容器內部\
`config-vol` 是一個 volume 的名稱，目標是 `log-config` 這個 configMap 的 `log_level` 這個 key\
將這份資料掛載到 `log_level.conf` 這個檔案裡面

那這個檔案在哪裡呢？\
`volumeMounts` 裡面的 `mountPath` 就是檔案掛載的路徑\
所以檔案完整路徑會是 `/etc/config/log_level.conf`

你也可以使用 [subPath](#precision-control-with-subpath) 的方式掛載資料，需要注意的是\
Pod 並不會自動拉取新的資料，等於說你需要手動重啟 Pod 才能看到新的資料

## Projected Volume
Projected Volume 並不是介於 [Ephemeral Volume](#ephemeral-volume) 與 [Persistent Volume](#persistent-volume) 之間的東西\
而是一種特殊型態的 volume，將不同類型的 volume 掛載到相同資料夾下並統一管理\
目前來說僅有少數 volume 支持這種特性，其中最著名的是 `configMap` 以及 `secret`

> 要想掛載到同一個資料夾底下，這些 volume 必須處於同一個 namespace 下

掛載到相同資料夾底下有什麼好處？\
有些 use case 是你的 deployment 需要設定檔，也同時需要 API key 這種東西\
如果分開掛載，是不是就分隔兩地了？ 所以開發者們希望有一個統一管理的地方，至少他們是這樣覺得的(可參考 [all-in-one volume](https://github.com/kubernetes/design-proposals-archive/blob/main/node/all-in-one-volume.md) design)

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: volume-test
spec:
  template:
    spec:
      containers:
      - name: container-test
        image: busybox
        command: [
          "sh", 
          "-c", 
          "echo /projected-volume/my-group/my-username; 
          echo /projected-volume/my-group/my-config"
        ]
        volumeMounts:
        - name: all-in-one
          mountPath: "/projected-volume"
          readOnly: true
      volumes:
      - name: all-in-one
        projected:
          sources:
          - secret:
              name: mysecret
              items:
                - key: username
                  path: my-group/my-username
          - configMap:
              name: myconfigmap
              items:
                - key: config
                  path: my-group/my-config
```

如果你的 volume 都掛載到同一個檔案是會錯誤的\
比如說都是 `mygroup/my-data` 就會出錯

## Persistent Volume
如果這個 volume 是與 Pod 本身的生命週期相互獨立的，那我們稱這類 volume 為 [Persistent Volume](#persistent-volume)

### local
local 是指定到 node 上的 **掛載資源路徑**(如 外接硬碟)\
它最終還是依賴於節點本身，你需要依靠節點去存取這些資源

> local volume 不支援動態配置

舉例來說，[libfuse/sshfs](https://github.com/libfuse/sshfs) 可以透過 SSH 將遠端的檔案系統掛載到本機上\
一樣的概念，檔案系統不在本機上，但你可以 mount 到本機，使得操作起來跟本機的檔案系統一樣

話雖如此，如果你的節點掛了，那你就無法存取到這個 volume 了\
volume 還是好的，是因為 node 掛掉\
因此，local volume 會在一定程度上受到節點可用性的影響

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: example-pv
spec:
  capacity:
    storage: 100Gi
  volumeMode: Filesystem
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Delete
  storageClassName: local-storage
  local:
    path: /mnt/disks/ssd1
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - example-node
```

# How should you Use Persistent Volume?
相比於 [Ephemeral Volume](#ephemeral-volume)，Persistent Volume 的使用是比較複雜的\
有了 [Persistent Volume](#persistent-volume) 其實是不夠的，因為他的生命週期與 Pod 本身獨立\
如果 [PV](#persistent-volume) 允許直接掛上去，那等於綁定其 lifecycle，而這不是我們所想要的

[Persistent Volume Claim](#persistent-volume-claim) 就是用來解決這個問題的\
這個 Resource 表示的是 **a request for storage by a user**\
等於說是個令牌的概念，這個 Claim 裡面包含了許多資訊，比方說你要的這個空間要多大、權限是什麼等等的\
因為 [Persistent Volume](#persistent-volume) 包含了滿多底層的資訊\
講好聽點是細節豐富，但實際上就是複雜，使用者不需要知道這麼多東西，因此多個一個 **Claim** 的概念簡化

如果你要不到想要的資源，可能是目前可用的 [PV](#persistent-volume) 他們的空間不夠，或者是權限沒辦法滿足你的需求\
其實這些需求可以被寫成所謂的 [StorageClass](#storage-classes)，算是一個分組的概念\
每個 [PV](#persistent-volume) 基本上可以被歸類到某個 StorageClass 底下(但有些不能)\
歸類有啥用呢？ 因為某些 [PV](#persistent-volume) 是可以根據 StorageClass 動態建立的

> 需要動態建立的 StorageClass 必須要啟用 `DefaultStorageClass` Admission Controller

如果真的遇到只能靜態建立的 StorageClass，那就只能等了

## Persistent Volume Claim
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myclaim
spec:
  accessModes:
    - ReadWriteOnce
  volumeMode: Filesystem
  resources:
    requests:
      storage: 8Gi
  storageClassName: slow
  selector:
    matchLabels:
      release: "stable"
    matchExpressions:
      - {key: environment, operator: In, values: [dev]}
```

PVC 表示的是你希望拿到什麼樣子的 [PV](#persistent-volume)\
包含他的 Access Modes, Storage Class, 以及大小等等的

如果 PVC 中有指定 StorageClass，則 Control Plane 除了基本大小的確認，也會保證 StorageClass 是相同的\
設定成 `""` 呢？ 你也只能挑選 StorageClass 為 `""` 的 [PV](#persistent-volume) 中選擇

> 請注意到，`storageClassName: ""` 與沒有設定 storageClassName 是不同的

當你想要改變預設的 default StorageClass 的時候，需要特別注意的是\
如果在這中間有任何 PVC 被建立，他們的 StorageClass 不會有預設值的(`""` 並不是預設值)\
所以針對那些沒有 StorageClass 的 PVC，我會自己幫你填入 `Default StorageClass`

什麼意思？\
當新的 Default StorageClass 被指定，所有缺少 StorageClass 的 PVC 都會被自動填入 Default StorageClass\
包含像是
1. 空值
2. `storageClassName` 這個 key 不存在

的時候，會被填入當前 Default StorageClass\
這個行為被稱作 `Retroactive default storageClass assignment`

<hr>

那 PVC 要如何被使用，就跟 [Ephemeral Volume](#ephemeral-volume) 一樣，透過 `volumeMounts` 來掛載

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  containers:
    - name: myfrontend
      image: nginx
      volumeMounts:
      - mountPath: "/var/www/html"
        name: mypd
  volumes:
    - name: mypd
      persistentVolumeClaim:
        claimName: myclaim
```

## Storage Classes
不同的儲存空間擁有不同的特性，例如說不同的 backup 策略、不同的等級或者是不同的 SLA\
cluster administrator 透過定義一或多個 `StorageClass` 來表示說本 cluster 提供哪些類型的儲存空間

有些 StorageClass 只能透過靜態的方式建立，比如說 [local](#local)

```shell
$ kubectl get storageclasses.storage.k8s.io local-path -o yaml 
```

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  annotations:
    defaultVolumeType: local
    objectset.rio.cattle.io/applied: H4sIAAAAAAAA/4
    objectset.rio.cattle.io/id: ""
    objectset.rio.cattle.io/owner-gvk: k3s.cattle.io/v1, Kind=Addon
    objectset.rio.cattle.io/owner-name: local-storage
    objectset.rio.cattle.io/owner-namespace: kube-system
    storageclass.kubernetes.io/is-default-class: "true"
  creationTimestamp: "2025-10-31T15:16:17Z"
  labels:
    objectset.rio.cattle.io/hash: 183f35c65ffbc3064603f43f1580d8c68a2dabd4
  name: local-path
  resourceVersion: "282"
  uid: 55db47f6-e45f-4308-b085-cf68e8c9b159
provisioner: rancher.io/local-path
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
```

一般來說，`StorageClass` 會有這些 properties
1. **provisioner**
2. **parameters**
3. **reclaim policy**

> `storageclass.kubernetes.io/is-default-class` 是用來標示說這個 StorageClass 是預設的

> 有些 Volume 是允許你擴展大小的，注意到只能增加不能減少(i.e. `allowVolumeExpansion: true`)

## Put it All Together
在 Pod 層面，你透過 [Persistent Volume Claim](#persistent-volume-claim) 來申請一個 volume\
Control Plane 會根據你的需求，幫你找到適合的 [Persistent Volume](#persistent-volume)\
你能拿到的 [PV](#persistent-volume) 一定是符合你的要求，某些時候甚至會是超出你的需求\
注意到，[PV](#persistent-volume) 與 [PVC](#persistent-volume-claim) 之間是 1:1 的關係，一個 [PVC](#persistent-volume-claim) 只能對應到一個 [PV](#persistent-volume)\
比方說 50GB 的 [PV](#persistent-volume) 是不可能被申請 100GB 的 [PVC](#persistent-volume-claim) 所使用的

綁定(i.e. `Binding`)過後的 [PV](#persistent-volume) 可以使用多久呢？\
你想要用多久就可以用多久的那種程度

在使用的過程中，任何的刪除都會造成嚴重的傷害\
所以基本的保護需要做到(i.e. `Use Protection`)，比如說
+ `PVC` 只有在 "沒有任何 Pod" 使用的情況下才會真正被刪除
+ `PV` 只有在 "沒有任何 PVC" 使用的情況下才會真正被刪除

即使正在使用中，你強行刪除也會被阻擋(c.f. **Finalizers**)

當你使用完畢，[PV](#persistent-volume) 可以被其他人重複利用，不過複用之前可能要稍微處理一下\
他有以下幾種選擇(i.e. `Reclaim Policy`)
1. Retain 保留，將資料保留在磁碟上，由 admin 決定如何處置
2. Delete 刪除，將資料刪除，磁碟空間釋出
3. Recycle 回收，本質上就是將資料刪除然後重新使用，這個選項已經被棄用，建議使用 `Dynamic Provisioning`

不過 1:1 的關係，會不會造成使用上的困擾，比方說我只是想讀取資料而已沒有要寫\
有沒有一種辦法允許多個 Pod 使用同一個 [PV](#persistent-volume)？\
可以透過 Access Modes 來實現
+ `ReadWriteOnce`: 單一節點，可讀寫
+ `ReadOnlyMany`: 多節點，可讀
+ `ReadWriteMany`: 多節點，可讀寫
+ `ReadWriteOncePod`: 單一節點內的單一 Pod，可讀寫

[PV](#persistent-volume) 與 [PVC](#persistent-volume-claim) 是一對一\
可沒說 Pod 跟 [PVC](#persistent-volume-claim) 是一對一\
事實上，透過以上不同的存取模式，同一個 [PVC](#persistent-volume-claim) 可以被多個 Pod 使用

# Difference Between [hostPath](#hostPath) and [local](#local)
同樣都是存取節點上的資料，區分 [hostPath](#hostPath) 與 [local](#local) 是有意義的\
不單單只是因為掛載的方式差異，更多的是 scheduler 對於兩者有著不同的處理方式

> 我當然可以用 [hostPath](#hostpath) 指到一個掛載上去的硬碟\
> 這不會錯，是可以正常運行的

我們知道，Pod 最終會被 scheduler 排程到某一個節點上運行\
並且 Pod 會因為各種原因被重新排程，跑到不同的節點上執行\
[hostPath](#hostpath) 在不同的節點上，代表著不同的實體儲存空間

比方說
+ `Node A`: `/var/log/auth.log`
+ `Node B`: `/var/log/auth.log`

即使 hostPath 的路徑相同，它也是在不同的節點上，資料當然是不一樣的\
而且 scheduler 並不知曉這件事情\
所以這是為什麼 [hostPath](#hostpath) 被設計成是 `Ephemeral Volume`

相反的，[local](#local) 雖然也是依賴於節點，但是它會透過 **node affinity** 來標示\
啥意思？ 外接硬碟理論上同一時間只能被掛載到唯一的節點上，你需要標示說這個 volume 是在哪一個節點上的\
如果需要 [local](#local) 的 Pod 則會被排程到相同的節點上(就是依靠 node affinity 來實現)

> 為什麼要同一個節點？ 設計 persistent volume 不就是為了抽象化嗎？\
> 是這樣沒錯，但是它不像 object storage 從哪裡都拿的到對吧

# References
+ [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
+ [Projected Volumes](https://kubernetes.io/docs/concepts/storage/projected-volumes/)
+ [Ephemeral Volumes](https://kubernetes.io/docs/concepts/storage/ephemeral-volumes/)
+ [Volumes](https://kubernetes.io/docs/concepts/storage/volumes/)
+ [Using subPath](https://kubernetes.io/docs/concepts/storage/volumes/#using-subpath)
+ [What is the difference between subPath and mountPath in Kubernetes](https://stackoverflow.com/questions/65399714/what-is-the-difference-between-subpath-and-mountpath-in-kubernetes)
+ [Fixing the Subpath Volume Vulnerability in Kubernetes](https://kubernetes.io/blog/2018/04/04/fixing-subpath-volume-vulnerability/#kubernetes-background)
+ [Mounting a volume over existing data](https://docs.docker.com/engine/storage/volumes/#mounting-a-volume-over-existing-data)
+ [详解 Kubernetes Volume 的实现原理](https://draven.co/kubernetes-volume/)
+ [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
+ [Can we connect multiple pods to the same PVC?](https://stackoverflow.com/questions/67345577/can-we-connect-multiple-pods-to-the-same-pvc)
