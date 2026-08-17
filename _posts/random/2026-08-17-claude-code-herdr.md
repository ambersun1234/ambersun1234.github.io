---
title: Herdr 搭配 Moshi 就可以搭起你的行動辦公站！ 有沒有這麼簡單
date: 2026-08-17
categories: [random]
description: 想要輕量級工作站，筆電、平板都不夠看，用手機寫 code 才是我理想中的極致輕量化。本文介紹了如何結合 Herdr（終端 AI 代理管理器）、Moshi（行動終端 App）與 Tailscale（虛擬私有網路），打造一套能夠隨時隨地透過手機遠端監控、管理並與多個 Claude Code 代理協作的輕量級行動工作站
tags: [claude code, claude, slack webhook, herdr, tmux, space, pane, ai agent, agent, git, worktree, main worktree, linked worktree, claude md, moshi, ssh , tailscale, wireguard, p2p, coordination server, ip]
math: true
---

# Claude Code Impression
我算是很晚才接觸 AI Agent 這種東西\
使用 `Claude Code` 不過短短兩週，我就發現說其實他能夠大幅的增加開發速度\
誒這就有趣了老實說

那現在我的工作變成類似 PM 的角色這樣\
確認規格書，確保做出來的東西真的是老闆要的或客戶要的\
然後就是確認系統架構可行性，做個 POC 等等的

有了 `Claude Code` 我絕大多數的時間都是花在溝通上面\
某種程度上來說也好啦，畢竟之前都把技能樹點在實作上

## Wait, Wait and Wait
功能開發前期其實對 **等待** 這件事情沒有什麼太多感覺\
因為這時候多半時間都是在跟 `Claude Code` 對現有系統實作做評估\
比方說
+ 確認當前系統架構能不能兼容新的功能，有沒有什麼東西需要調整
+ 看說哪部分是需要做驗證的，讓他下去執行並回報

等等

但是真正到開發的時候，這個等待就會更... 明顯\
有些功能是有相依性的，例如說底層要先改好，上層才能夠同步開展工作\
這時候其實你能做的有限，只能等他跑完，逐一的驗證(i.e. 手動 code review, 把服務跑起來親自測試 ... etc.)

# How should I Know when Claude Code Finish
所以當他做完，如果你沒有第一時間知曉，其實會滿浪費時間的\
剛開始我就是用基本的 [Slack Webhook](#slack-webhook)

## Slack Webhook
設定上其實很簡單，而且 `Claude Code` 自己也會跟你說要怎麼設定\
把兩邊連起來就可以了

![](/assets/img/posts/claude1.jpg)

![](/assets/img/posts/claude2.jpg)

那其實剛開始我覺得這樣就夠了老實說

# Herdr
為什麼會提到 [Herdr](https://herdr.dev/) 呢

其實我原本是單純的 cli 上面直接跑 `Claude Code`\
為什麼選擇下載這種 Agent Multiplexer 呢？\
因為我發現單純用 `Claude Code` 的限制，就是一次只能跑一個 session\
你說我可以用 [tmux](https://tmux.app/) 然後裡面開 `Claude Code` 啊？

但這樣就不太好用\
你想哦，如果你是用 [Slack Webhook](#slack-webhook) 然後多開 `Claude Code`\
Webhook 本身的能力並沒有太強大，你會不知道是哪個 session 卡住或是做完了\
造成管理上麻煩

[Herdr](https://herdr.dev/) 其實解決了這個痛點，而且不只這個痛點

## Installation
安裝其實滿簡單的

```shell
$ curl -fsSL https://herdr.dev/install.sh | sh
$ herdr integration install claude
$ npx skills add herdrdev/herdr --skill herdr -g
```

> integration 是看你用哪個，我用 Claude Code

## From Tmux to Herdr
我之前是 [tmux](https://tmux.app/) 的長期使用者\
換到 [Herdr](#herdr) 可以說是完全沒有任何問題

原因在於，[Herdr](#herdr) 的操作邏輯也是與 [tmux](https://tmux.app/) 極為相似\
都是要先按 prefix 搭配不同的按鍵組合，就可以做到切換、移動等等的

> 自定義按鍵也是非常簡單明瞭的

你也不用擔心他只能用鍵盤，相反他可是原生支援滑鼠這件事情的\
能用鍵盤做的，用滑鼠也能做

## Herdr UI
![](https://blog.moewah.com/_astro/Herdr.ChX9LS4D_Z1P9Au2.webp)
> ref: [有了 tmux 还需要 herdr 吗？一个给 AI Agent 用的「终端管家」](https://blog.moewah.com/posts/herdr-agent-multiplexer-review/)

主要就三大塊
+ 左下: 是你目前全部開的 agent 的狀態，你可以很清楚的看到誰在工作、誰在等輸入或者是已經做完了再等下一步指示
+ 右邊: 是你主要的操作區塊，他也可以開分頁(i.e. `pane`)，每個分頁都是一個 terminal，當然你要跑 Agent 也沒問題
+ 左上: 稱為 `space`，這塊可以當成專案的功能或是不同專案的空間，本質上是讓你把一整套相關的服務擺在一起的地方

一個 space 裡面可以開多個分頁(`pane`)\
你可以比如說
1. 一邊請他針對這個功能的某個部分進行 POC
2. 一邊跟他討論該架構的設計

## The Problem I have When Using Herdr
### Agent No Status?
雖然說我覺得很好用，可是我也把壞習慣帶到 [Herdr](#herdr) 上面

前面在 [Herdr UI](#herdr-ui) 有提到，右側基本上就是主要操作區域，那他本質上是 terminal\
於是呢，我就先開了 [tmux](https://tmux.app)，再啟動 `Claude Code`\
這樣做的問題在於，[Herdr](#herdr) 沒辦法感知 Agent 的狀態\
自然而然地他就沒有顯示狀態這樣

那也因為 UI 本身就支援多分頁，所以 [tmux](https://tmux.app) 的用處就不太大這樣

### Git Worktree
我們在 [Git 進階使用 - Git Worktree 多工的好朋友 \| Shawn Hsu](../../git/git-worktree) 裡面有提到\
現代 AI Agent 搭配上 Git Worktree 好處多多

那 [Herdr](#herdr) 他對這邊的支援如何？\
我一開始是已經有 worktree 我想要把它開成 `space`\
這部分其實我找了一下，你要切到相對應的 repo 他才會正確顯示出來

![](/assets/img/posts/herdr-worktree1.jpg)

![](/assets/img/posts/herdr-worktree2.jpg)

差別在於，上面那張圖指到的是 `main worktree`\
他能夠開 `linked worktree`

而下圖指到的 space 是 `linked worktree`，他沒有能力再長出來\
然後你也能夠看到說我開了滿多個 worktree 這樣

開 worktree 有幾種辦法
1. 一個是你在當前 `Claude Code` session 請 AI 幫你開一個出來，然後你在 [Herdr](#herdr) 手動 open worktree 到 space
2. 另一種是 [$ herdr worktree create](https://herdr.dev/docs/cli-reference/#worktrees) 適合不在 AI session 裡面的你手動自己建

1 的話可以寫 *CLAUDE.md* 讓他每次建的時候都放在相同位置\
2 的話可以用設定檔
```shell
$ vim ~/.config/herdr/config.toml
[worktree]
directory = "~/Documents/gitRepo/worktree"
```

> 注意到這不是強制性的，就算你把 worktree 亂丟，他還是都找得到，透過 git 內建強大的機制

# My Ultimate Portable Station
那這樣肯定是不夠變身成行動工作站的

[Herdr](#herdr) 本身是 Client-Server 的架構\
跑起來會是 `一個 server 配一或多個 client`\
所有東西都是在 server 上，而 client 就是單純的 UI 而已

重點是，[Herdr](#herdr) 如果意外被關閉，他其實是會活著的\
也就是說你不用擔心意外把它關掉之後 session 就找不回來(當然，重開機這種就不算了)

```shell
$ herdr
# close the server
$ herdr
# still have your session there!
```

如果你真的想要結束，就要使用 `$ herdr server stop`\
那既然他是 Client-Server，事情就變得很好玩了哦~

我能不能讓 server 開著，然後利用各種遠端手法連線回去呢？\
反正 Client 只是單純 UI，而事實上官方也的確建議這樣做

你可以直接用手機做遠端連線，比方說使用 [Moshi](#moshi)

## Moshi
用手機連到 [Herdr](#herdr) Server，其實本質上也跟 *SSH* 一樣\
[Moshi](https://getmoshi.app/) 是一個 `Terminal For Claude Code & AI Agents`

不過 [Moshi](https://getmoshi.app/) 本身除了基本的 *SSH* 他還跟 AI Agents 這邊有深度整合\
就好比說 [Herdr](#herdr) 的整合推播通知、常用指令按鈕化等等的功能\
不過這些進階的功能就是要收費的了

<video width="100%" autoplay loop muted playsinline>
  <source src="https://getmoshi.app/videos/herdr-moshi.mp4" type="video/mp4">
  您的瀏覽器不支援影片標籤。
</video>
> ref: [Herdr](https://getmoshi.app/docs/herdr)

那這樣就沒用了嗎？\
其實不然，Moshi 對一般連線是免費的，況且 [Herdr](#herdr) *SSH* 畫面可以自適應\
如果你不需要很即時的接收通知，他仍然是一個很好的工具可以利用

> 比如說你可以 Server 擺在家裡開著，手機連回來操作，也不錯啊對吧

||||
|:--:|:--:|:--:|
||![](https://herdr.dev/assets/mobile-agent-session-v2.jpeg)|![](https://herdr.dev/assets/mobile-switch-menu-v2.jpeg)|
|ref|[How to work with Herdr](https://herdr.dev/docs/how-to-work/)|[How to work with Herdr](https://herdr.dev/docs/how-to-work/)|

# Final Step to Portable Workstation - Tailscale
你有了 Server, Client 也沒問題\
你還缺網路，沒有網路你在外面逛街，再怎麼樣也無法操作家裡的 `Claude Code`

[Tailscale](https://tailscale.com) 能夠將你的所有裝置(即使不同網路下)，串接到同一個私有虛擬網路\
你可以把它想成所有裝置都在同一個網路底下，誒那既然是同一個網路，就代表 SSH 找得到對方了\
也因此你就能夠做到遠端連線了

[Tailscale](https://tailscale.com) 是基於 WireGuard 協定，裝置之間一開始會透過 Coordination Server 交換資訊\
線路通了之後就是純裝置之間溝通(i.e. `P2P`) 了\
資料傳輸更安全，也因為沒過第三方，延遲更低更快速

設定方面也超簡單，像我這種網路苦手，也快速上手\
你完全不需要做任何複雜設定，什麼開 port 防火牆什麼的都不用，只要下載 app，裝起來就可以了

![](https://static0.xdaimages.com/wordpress/wp-content/uploads/wm/2025/05/tailscale-admin-portal.png?q=49&fit=contain&w=750&h=422&dpr=2)
> ref: [These Tailscale extensions make managing my containers much simpler](https://www.xda-developers.com/tailscale-extensions-make-managing-my-containers-easier/)

每個裝置都能獲得一個 ip，不需要你也可以讓裝置下線他就連不到\
那 ip 公布他會不會被其他人登入？ 是不會的，因為他是用身份認證的技術去做的\
只有登入相同帳號的裝置可以互相通訊

# Conclusion
所以到這邊\
[Herdr](#herdr) 搭配 [Moshi](#moshi) 就能夠實現最小的遠端辦公配置\
再加上 [Tailscale](#final-step-to-portable-workstation---tailscale) 你就能實現跨區域遠端辦公

# References
+ [有了 tmux 还需要 herdr 吗？一个给 AI Agent 用的「终端管家」](https://blog.moewah.com/posts/herdr-agent-multiplexer-review/)
+ [Worktrees](https://herdr.dev/docs/cli-reference/#worktrees)
+ [Herdr](https://getmoshi.app/docs/herdr)
