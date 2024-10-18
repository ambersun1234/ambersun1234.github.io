---
title: DevOps - 透過 Helm Chart 建立你自己的 GitHub Action Runner
date: 2024-10-03
categories: [devops]
description: 本文會記錄如何使用 Helm Chart 建立 local runner 以及中間遇到的困難點
tags: [github action, local runner, helm chart, kubernetes, rancher, customize runner image]
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
$ kubectl create secret generic arc-secrets \
   --namespace=arc-runners \
   --from-literal=github_app_id=123456 \
   --from-literal=github_app_installation_id=654321 \
   --from-literal=github_app_private_key='-----BEGIN RSA PRIVATE KEY-----********'
```

# Install Local Runner
GitHub 其實幫你把這個包的很好了，你可以簡單地透過 Helm Chart 安裝\
總共就兩個步驟，[Action Runner Controller](#action-runner-controller) 跟 [Action Runner](#action-runner) 即可

> 雖然官方文件寫，希望你可以將 controller 以及 runner 分開到不同的 namespace\
> 但是這個實際上會有問題，所以還是放在一起，以本文來說就是 `arc-runners`

## Action Runner Controller
```shell
$ kubectl create namespace arc-runners
$ helm install arc \
    --namespace "arc-runners" \
    oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller

Pulled: ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller:0.9.3
Digest: sha256:4fda46fd8c4e08fe2e3d47340573f98d7a9eeb4c3a474b0e2b08057ab24d50a9
NAME: arc
LAST DEPLOYED: Wed Oct  2 01:19:15 2024
NAMESPACE: arc-runners
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
Thank you for installing gha-runner-scale-set-controller.

Your release is named arc.
```

> 如果你要重新安裝，記得要 `$ helm uninstall arc -n arc-runners` 先把舊的刪掉

驗證一下 controller 有沒有正常跑起來
```shell
$ kubectl get pods -n arc-runners
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

至於說 GitHub App 的方式稍早我們有建立了一組 secret `arc-secrets`，所以這裡就可以直接使用
```shell
$ kubectl create namespace arc-runner
$ helm install "self-hosted" \
    --namespace "arc-runner" \
    --set githubConfigUrl="https://github.com/ORGANIZATION" \
    --set githubConfigSecret="arc-secrets" \
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

用 `$ helm list -A` 看有沒有正確安裝 release 上去\
以及使用 `$ kubectl` 指令確認，理論上會有兩個 pod 啟動，一個是 controller 一個是 listener\
注意到 listener 必須要啟動你的 action 才會成功被觸發

你也可以觀察 runner pod 的狀態，每一次 trigger 都會有一個 pod 被啟動\
所以不同的 action 之間是使用獨立的 pod 來執行的

> 我們 deploy 的 helm chart 都是 scale set\
> `gha-runner-scale-set-controller` 以及 `gha-runner-scale-set`

# Input 'submodules' not supported when falling back to download using the GitHub REST API
當你都設定完成之後，實際執行 GitHub Action 的時候，checkout 會遇到這個錯誤
```
Error: Input 'submodules' not supported when falling back to download using the GitHub REST API. 
To create a local Git repository instead, add Git 2.18 or higher to the PATH.
```

根據所述 [Git version must 2.18 or higher??!!](https://github.com/actions/checkout/issues/255)

> When Git 2.18 or higher is not in the path, it falls back to the REST API to download the tarball.

所以即使沒有 Git 2.18 以上，也應該可以正常運作\
double check 你的上述的權限是否有正確的設定

> 在 [repository not found](https://github.com/actions/checkout/issues/254) 中其實一直有人反應\
> 從 2020 年開始到文章撰寫的期間都還是一直有狀況

<hr>

或者是還有一個可能性\
runner 沒有讀到你的 secret 資料

在 [Runner Scale Set: "No gha-rs-controller deployment found" when rendering Helm chart](https://github.com/actions/actions-runner-controller/issues/3043) 裡面有人有遇到跟我一樣的問題\
具體上來說都是碰到 service account 無法讀取 secret 的問題

```shell
2024-01-05T23:53:24Z ERROR Reconciler error 
{
    "controller": "autoscalingrunnerset", 
    "controllerGroup": "actions.github.com", 
    "controllerKind": "AutoscalingRunnerSet", 
    "AutoscalingRunnerSet": {
        "name":"arc-controller",
        "namespace":"arc-systems"
    }, 
    "namespace": "arc-systems", 
    "name": "arc-controller", 
    "reconcileID": "84ec6789-7f67-430f-98aa-df8f35f18b7a", 
    "error": "failed to find GitHub config secret: secrets 'arc-controller-gha-rs-github-secret' is forbidden: User 'system:serviceaccount:arc-runners:arc-gha-rs-controller' cannot get resource 'secrets' in API group '' in the namespace 'arc-systems'"
}
```

根據它提供的解法，我們只需要在 [values.yaml](https://github.com/actions/actions-runner-controller/blob/master/charts/gha-runner-scale-set/values.yaml#L195) 裡面加入以下的設定即可

```yaml
controllerServiceAccount:
  namespace: arc-runners
  name: arc-controller-gha-rs-controller
```

其中 namespace 就是 Helm Chart 安裝的 namespace，`arc-controller` 是 Helm Release 的名稱\
也因為如此，在安裝 [Action Runner](#action-runner) 的時候，也要加上這個設定\
你可以嘗試把所有東西放在 values.yaml 裡面然後在 install 會比較簡潔

```yaml
githubConfigUrl: https://github.com/ORGANIZATION
githubConfigSecret: arc-secrets
controllerServiceAccount:
  namespace: arc-runners
  name: arc-controller-gha-rs-controller
```

```shell
$ helm install "self-hosted" \
    --namespace "arc-runner" \
    --values "values.yaml" \
    oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set
```

# Customize Runner Image
當好不容易成功執行起來之後，我遇到了一些工具沒有安裝的問題\
像是 `make`, `ssh` 之類的\
好在你其實可以把 runner image 替換成你自己的 image

```dockerfile
FROM mcr.microsoft.com/dotnet/runtime-deps:6.0 AS build

# Replace value with the latest runner release version
# source: https://github.com/actions/runner/releases
# ex: 2.303.0
ARG RUNNER_VERSION="2.320.0"
ARG TARGETARCH
# Replace value with the latest runner-container-hooks release version
# source: https://github.com/actions/runner-container-hooks/releases
# ex: 0.3.1
ARG RUNNER_CONTAINER_HOOKS_VERSION="0.6.1"

ARG DOCKER_VERSION=27.1.1
ARG BUILDX_VERSION=0.16.2

ENV DEBIAN_FRONTEND=noninteractive
ENV RUNNER_MANUALLY_TRAP_SIG=1
ENV ACTIONS_RUNNER_PRINT_LOG_TO_STDOUT=1

WORKDIR /home/runner

RUN apt update -y && apt install curl unzip -y

RUN export RUNNER_ARCH=${TARGETARCH} \
    && if [ "$RUNNER_ARCH" = "amd64" ]; then export RUNNER_ARCH=x64 ; fi \
    && curl -f -L -o runner.tar.gz https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz \
    && tar xzf ./runner.tar.gz \
    && rm runner.tar.gz

RUN curl -f -L -o runner-container-hooks.zip https://github.com/actions/runner-container-hooks/releases/download/v${RUNNER_CONTAINER_HOOKS_VERSION}/actions-runner-hooks-k8s-${RUNNER_CONTAINER_HOOKS_VERSION}.zip \
    && unzip ./runner-container-hooks.zip -d ./k8s \
    && rm runner-container-hooks.zip

RUN export RUNNER_ARCH=${TARGETARCH} \
    && if [ "$RUNNER_ARCH" = "amd64" ]; then export DOCKER_ARCH=x86_64 ; fi \
    && if [ "$RUNNER_ARCH" = "arm64" ]; then export DOCKER_ARCH=aarch64 ; fi \
    && curl -fLo docker.tgz https://download.docker.com/linux/static/stable/${DOCKER_ARCH}/docker-${DOCKER_VERSION}.tgz \
    && tar zxvf docker.tgz \
    && rm -rf docker.tgz \
    && mkdir -p /usr/local/lib/docker/cli-plugins

RUN curl -fLo /usr/local/lib/docker/cli-plugins/docker-buildx \
    "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-${TARGETARCH}" \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

FROM mcr.microsoft.com/dotnet/runtime-deps:6.0 AS final

WORKDIR /home/runner

RUN adduser --disabled-password --gecos "" --uid 1001 runner \
    && groupadd docker --gid 123 \
    && usermod -aG sudo runner \
    && usermod -aG docker runner \
    && echo "%sudo   ALL=(ALL:ALL) NOPASSWD:ALL" > /etc/sudoers \
    && echo "Defaults env_keep += \"DEBIAN_FRONTEND\"" >> /etc/sudoers

COPY --from=build /home/runner /home/runner
COPY --from=build /usr/local/lib/docker/cli-plugins/docker-buildx /usr/local/lib/docker/cli-plugins/docker-buildx

RUN apt update -y && apt install ssh build-essential git -y

RUN chown -R runner /home/runner
RUN install -o root -g root -m 755 docker/* /usr/bin/ && rm -rf docker

USER runner
```

> 你也可以手動 build\
> `$ docker build -t ambersun1234/arc-runner:latest -f Dockerfile .`

runner base image 有兩個大要求，就是必須要有 [actions/runner](https://github.com/actions/runner) 以及 [actions/runner-container-hooks](https://github.com/actions/runner-container-hooks) 兩者的 binary 在 `/home/runner` 底下\
所以前半的 multi-stage build 就是在做這件事情

後面的部分就是安裝一些我需要的工具，像是 `ssh`, `build-essential`, `git` 之類的\
然後要設定 runner user 用以執行

## Docker in Docker
然後如果你的 action 需要執行 build image 之類的事情\
你需要開啟 [Docker in Docker mode](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/deploying-runner-scale-sets-with-actions-runner-controller#using-docker-in-docker-mode)

> 上面的 Dockerfile 我們有安裝了 `docker` 以及 `docker-buildx`

透過設定 values.yaml(往下看有完整範例)
```yaml
containerMode:
  type: "dind
```

## Install
基本上你可以參考 [Creating your own runner image](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/about-actions-runner-controller#creating-your-own-runner-image) 進行魔改就可以了\
但是呢，這篇沒跟你講怎麼用

根據 [Configuring the runner image](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/deploying-runner-scale-sets-with-actions-runner-controller#configuring-the-runner-image)，你一樣要進行修改，在 [values.yaml](https://github.com/actions/actions-runner-controller/blob/master/charts/gha-runner-scale-set/values.yaml) 裡面修改 template spec 的 image\
所以你的 [Action Runner](#action-runner) 的設定就會變這樣

```yaml
githubConfigUrl: https://github.com/ORGANIZATION
githubConfigSecret: arc-secrets
containerMode:
  type: "dind"
template:
  spec:
    containers:
      - name: runner
        image: "ambersun1234/arc-runner"
        imagePullPolicy: Always
        command: ["/home/runner/run.sh"]
controllerServiceAccount:
  namespace: arc-runners
  name: arc-controller-gha-rs-controller
```

> 上述 values.yaml 啟用了 Docker in Docker mode\
> 設定了 runner image 為 `ambersun1234/arc-runner`\
> config secret 以及 config url\
> 你可以根據你的需要適當的進行微調

安裝也一樣
```shell
$ helm install "self-hosted" \
    --namespace "arc-runner" \
    --values "values.yaml" \
    oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set
```

針對上述的 customize image 我有編一份放在 [ambersun1234/arc-runner](https://hub.docker.com/r/ambersun1234/arc-runner)\
有 `linux/amd64` 跟 `linux/arm64` 兩個版本，你可以直接使用

# References
+ [Quickstart for Actions Runner Controller](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/quickstart-for-actions-runner-controller)
+ [Authenticating to the GitHub API](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/authenticating-to-the-github-api#deploying-using-personal-access-token-classic-authentication)
+ [About creating GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
+ [repository not found](https://github.com/actions/checkout/issues/254)
+ [Git version must 2.18 or higher??!!](https://github.com/actions/checkout/issues/255)
+ [Runner Scale Set: "No gha-rs-controller deployment found" when rendering Helm chart](https://github.com/actions/actions-runner-controller/issues/3043)
+ [Creating your own runner image](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/about-actions-runner-controller#creating-your-own-runner-image)
+ [Configuring the runner image](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/deploying-runner-scale-sets-with-actions-runner-controller#configuring-the-runner-image)
+ [Using Docker-in-Docker mode](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/deploying-runner-scale-sets-with-actions-runner-controller#using-docker-in-docker-mode)
