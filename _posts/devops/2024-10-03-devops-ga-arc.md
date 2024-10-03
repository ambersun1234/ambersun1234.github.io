---
title: DevOps - 透過 Helm Chart 建立你自己的 GitHub Action Runner
date: 2024-10-03
categories: [devops]
description: 本文會記錄如何使用 Helm Chart 建立 local runner 以及中間遇到的困難點
tags: [github action, local runner, helm chart, kubernetes, rancher]
math: true
---

# Preface
在 [DevOps - 從 GitHub Actions 初探 CI/CD \| Shawn Hsu](../../devops/devops-github-action) 裡面有提到，你可以使用自架的 local runner 執行你的 GitHub Action\
原因不外乎是因為 private repo 沒辦法免費的使用 GitHub 提供的 runner\
所以你可以選擇自己架設一個 runner，這樣就可以免費的使用了

本文會記錄如何使用 Helm Chart 建立 local runner 以及中間遇到的困難點

在開始之前\
既然是要使用 Helm Chart，那就必須要確保 Helm 以及 Kubernetes 都正確的安裝\
[Install Helm](https://helm.sh/docs/intro/install/) 以及 [Install k3d](https://k3d.io/v5.7.4/#installation)

# Token Setup
為了使 GitHub API 能夠正確的存取 [Action Runner Controller](#action-runner-controller)，你需要設定正確的 token

## Personal Access Token
可以使用傳統的 PAT 來設定

+ 針對 repo 等級的 runner 要給 `repo` 的權限
+ org 等級的 runner 要給 `admin:org` 的權限

> 這種做法如果是在公司使用會有難度，因為 PAT 是綁定在個人帳號上的\
> 所以可以嘗試使用 [GitHub App](#github-app) 來取代

## GitHub App
你可以使用 GitHub App 來取代 [Personal Access Token](#personal-access-token)\
GitHub App 可以把它想像成是一個擁有權限的機器人，你可以透過它來存取 GitHub API\
以我們的例子來說，就是可以透過 GitHub App 來存取 [Action Runner Controller](#action-runner-controller)

### Setup Permission
建立一個 GitHub App 之後，找到 permission 設定頁面
![](/assets/img/posts/runner-permission.png)

設定 repository 的 administration 的權限
![](/assets/img/posts/runner-repo.png)

> 如果是要設定 organization 的 runner 就不用設定 repository 的權限，直接設定 organization 的權限即可

設定 organization 的 self hosted runner 的權限
![](/assets/img/posts/runner-org.png)

### Prepare Kubernetes Secret
操作介面取得以下
1. App ID
    + 在 GitHub App 設定頁面，有一個 `App ID` 的數字
2. Private Key
    + 介面上產一把 private key
3. App Installation ID
    + 在 GitHub App 安裝頁面，觀察 URL 就可以得到
    ```
    https://github.com/organizations/ORGANIZATION/settings/installations/INSTALLATION_ID
    ```

要讓 ARC 能夠正確存取 GitHub API，你需要把這些資訊放到 Kubernetes 的 secret 裡面

```shell
$ kubectl create namespace arc-runners
$ kubectl create secret generic arc-secret \
   --namespace=arc-runners \
   --from-literal=github_app_id=123456 \
   --from-literal=github_app_installation_id=654321 \
   --from-literal=github_app_private_key='-----BEGIN RSA PRIVATE KEY-----********'
```

# Install Local Runner
GitHub 其實幫你把這個包的很好了，你可以簡單地透過 Helm Chart 安裝\
總共就兩個步驟，[Action Runner Controller](#action-runner-controller) 跟 [Action Runner](#action-runner) 即可

## Action Runner Controller
```shell
$ kubectl create namespace arc-systems
$ helm install arc \
    --namespace "arc-systems" \
    oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller

Pulled: ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller:0.9.3
Digest: sha256:4fda46fd8c4e08fe2e3d47340573f98d7a9eeb4c3a474b0e2b08057ab24d50a9
NAME: arc
LAST DEPLOYED: Wed Oct  2 01:19:15 2024
NAMESPACE: arc-systems
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
Thank you for installing gha-runner-scale-set-controller.

Your release is named arc.
```

> 如果你要重新安裝，記得要 `$ helm uninstall arc -n arc-systems` 先把舊的刪掉

驗證一下 controller 有沒有正常跑起來
```shell
$ kubectl get pods -n arc-systems
NAME                                     READY   STATUS    RESTARTS   AGE
arc-gha-rs-controller-5f79dc8687-l6cbd   1/1     Running   0          48s
```

## Action Runner
worker 的建立方式也一樣是用 Helm Chart\
但是這裡有兩種方法，你可以用 [Personal Access Token](#personal-access-token) 或者是 [GitHub App](#github-app) 來建立

PAT 的做法就只是將 credential 塞進去就可以了
```shell
$ kubectl create namespace arc-runner
$ helm install "self-hosted" \
    --namespace "arc-runner" \
    --set githubConfigUrl="https://github.com/ORGANIZATION" \
    --set githubConfigSecret.github_token="PERSONAL_ACCESS_TOKEN" \
    oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set
```

至於說 GitHub App 的方式稍早我們有建立了一組 secret `arc-secret`，所以這裡就可以直接使用
```shell
$ kubectl create namespace arc-runner
$ helm install "self-hosted" \
    --namespace "arc-runner" \
    --set githubConfigUrl="https://github.com/ORGANIZATION" \
    --set githubConfigSecret.github_token="arc-secret" \
    oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set
```

安裝好大概會長這樣
```
Pulled: ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set:0.9.3
Digest: sha256:ec6acc8503fe1140e7371656b2142c42be67741d93222de7af63e167f825e531
NAME: self-hosted
LAST DEPLOYED: Thu Oct  3 07:14:06 2024
NAMESPACE: arc-runner
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
Thank you for installing gha-runner-scale-set.

Your release is named self-hosted.
```

<hr>

看一下有沒有正常起來
```shell
$ kubectl get pods -n arc-runner
No resources found in arc-runner namespace.
```

注意到這個並不是你有寫錯，`arc-runner` 他會自己 scale\
用 `$ helm list -A` 看有沒有正常運作就可以了

# Input 'submodules' not supported when falling back to download using the GitHub REST API
當你都設定完成之後，實際執行 GitHub Action 的時候，checkout 會遇到這個錯誤
```
Error: Input 'submodules' not supported when falling back to download using the GitHub REST API. 
To create a local Git repository instead, add Git 2.18 or higher to the PATH.
```

根據所述 [Git version must 2.18 or higher??!!](https://github.com/actions/checkout/issues/255)

> When Git 2.18 or higher is not in the path, it falls back to the REST API to download the tarball.

所以即使沒有 Git 2.18 以上，也應該可以正常運作\
像我自己使用 GitHub App 理論上應該要是可以的\
但看起來可能是權限的問題，在 [repository not found](https://github.com/actions/checkout/issues/254) 中其實一直有人反應\
從 2020 年開始到文章撰寫的期間都還是一直有狀況

# References
+ [Quickstart for Actions Runner Controller](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/quickstart-for-actions-runner-controller)
+ [Authenticating to the GitHub API](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/authenticating-to-the-github-api#deploying-using-personal-access-token-classic-authentication)
+ [About creating GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
+ [repository not found](https://github.com/actions/checkout/issues/254)
+ [Git version must 2.18 or higher??!!](https://github.com/actions/checkout/issues/255)
