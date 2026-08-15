---
title: Git 進階使用 - Git Worktree 多工的好朋友
date: 2026-08-16
categories: [git]
description: 本文結合 Coding Agent 時代的多工開發需求，深入介紹 Git Worktree 的核心觀念、指令操作與實務注意事項，幫助你輕鬆在同一個專案中同時進行多個分支實驗，告別頻繁切換分頁與手動複製的痛點。
tags: [linux, version control, worktree, claude code, git, worktree, claude]
math: true
---

# Obstacles when Using Git
我還記得以前雖然已經很熟悉 Git 的操作，但其中一個最大的問題點在於說\
我如果想要對同一份 codebase 進行不同實驗，我沒辦法同時進行，除非說我把資料手動複製出來\
這個問題其實存在滿久的，而我一直沒有嘗試去解決它

直到 Coding Agent 的出現，這東西才又重新回到引起我的注意

## What does it Mean in Terms of Claude Code?
我在用 [Claude Code](https://claude.ai/) 的時候，也遇到了相同的問題\
隨著 AI Agent 的能力爆發，寫 code 的速度急速成長\
鑑於其多工的能力，如果沒辦法同時做多個 branch，那就喪失這種快速開發的能力了

# Git Worktree
所以 `Worktree` 就可以很好的解決這個問題，他允許你 **同時** checkout 多個 branch

架構上它分成兩種 worktree
+ `main worktree`: 就是你用 git init 建立的那個
+ `linked worktree`: 可以有 0 或多個，主要看你需求

每個 worktree 都有自己獨立的狀態，但是 `.git` 是共用的\
所以其實你不是用太擔心說硬碟空間會被用完這樣

## How Worktree Works
簡單的一行指令你就能夠建立 `linked worktree`

```shell
$ git worktree add feat/104/add-user-login /private/claude/xxx
```

這個 worktree 就會被建立在 `/private/claude/xxx` 這邊\
然後 branch 的名字也會被設定為 `feat/104/add-user-login`

那一個問題油然而生\
如果我開發過程中 base branch 更新，是要怎麼辦\
就直接 rebase 就可以了，很直覺吧

## Limitations
Worktree 在使用的時候有幾個需要注意

一個是，同一個 branch 不能長出多個 `linked worktree`\
這個也很好懂，多個相同 Worktree 他就會是處理相同的 codebase

再來當你完成 branch 開發需要刪除的時候\
要用 `$ git worktree remove` 指令，單純刪除資料夾並不會完整清除

# References
+ [Git Worktree](https://git-scm.com/docs/git-worktree)
