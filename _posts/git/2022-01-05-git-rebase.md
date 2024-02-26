---
title: Git 進階使用 - Git Rebase
date: 2022-01-05
description: Rebase 在 Git 裡面是一個很常見的技巧，透過 rebase 可以更改 commit message, re-order commits, squash commits 以及 pull base branch 的 changes。本文將會介紹 rebase 的基本概念以及如何使用 rebase 進行操作
categories: [git]
tags: [linux, version control]
math: true
redirect_from:
  - /posts/git-rebase/
sitemap: true
---

# Introduce to Git Rebase
Rebase 顧名思義，即更改目前的 base(分支基礎)\
rebase 在很多地方都很有用，包含像是更改 commit message, re-order commits, squash commits 以及 pull base branch 的 changes

這個指令可謂是多人協作下最常使用的 command，話不多說就讓我們開始吧

# Basic
rebase 的基本概念就是將 branch 的 base 進行更新，參考官網教學圖片
```
          A---B---C topic
         /
D---E---F---G master
```
目前 topic 的 `base` branch `master` 已經有新的 commit 了，為了要 fetch base 的 changes 可以下
```shell
$ git checkout topic
$ git rebase master
```
如此一來就會變成
```
              A'--B'--C' topic
             /
D---E---F---G master
```
> 注意到新的 commit 的 hash 會發生改變

# Move commit to another branch
有的時候，基於某種原因會需要將 **C** branch(based on **B** branch) 上的 commit 移到 **A** branch 之上
```
o---o---o---o---o  A
     \
      o---o---o---o---o  B
                       \
                        o---o---o  C
```
這時候有兩個解法

## Cherry-Pick
使用 cherry-pick 一個一個將 commit 撿到 target branch 上\
當然過程中可能會有 conflict 需要解

基本的過程如下所示
```shell
$ git checkout A
$ git cherry-pick c1
```

如果遇到 conflict, cherry-pick 就會暫停\
這時候你可以選擇 `$ git cherry-pick --abort` 取消 cherry-pick\
或解完衝突之後
```shell
$ // fix conflict
$ git add .
$ git cherry-pick --continue
```
> 切記改完衝突之後不需要 commit changes

```
o---o---o---o---o  A
    |            \
    \             o'---o'---o' C'
     \
      o---o---o---o---o  B
                       \
                        o---o---o  C
```
最後 cherry-pick 完之後原來的 `C branch` 記得要刪掉即可

## Rebase onto
```shell
$ git rebase --onto A B C
```
第一個參數是 target base branch 後面則是 source branch

# Interactive Mode
```
pick af38288 Fix collaborator's repo
pick 45ee847 Fix mv error
pick 31c1b30 Add ignore file
pick 8ee234f Fix token clone error
pick d223bd6 Update README

# Rebase ddc2d6d..d223bd6 onto 8ee234f (5 commands)
#
# Commands:
# p, pick <commit> = use commit
# r, reword <commit> = use commit, but edit the commit message
# e, edit <commit> = use commit, but stop for amending
# s, squash <commit> = use commit, but meld into previous commit
# f, fixup <commit> = like "squash", but discard this commit's log message
# x, exec <command> = run command (the rest of the line) using shell
# b, break = stop here (continue rebase later with 'git rebase --continue')
# d, drop <commit> = remove commit
# l, label <label> = label current HEAD with a name
# t, reset <label> = reset HEAD to a label
# m, merge [-C <commit> | -c <commit>] <label> [# <oneline>]
# .       create a merge commit using the original merge commit's
# .       message (or the oneline, if no original merge commit was
# .       specified). Use -c <commit> to reword the commit message.
```
透過 interactive mode 可以更方便的執行各種操作\
使用的方式為 `$ git rebase -i HEAD~5`
> 其中 HEAD~5 表示 rebase 到距離當前 HEAD 五筆的 commit\
> 前一筆 : HEAD^\
> 前二筆 : HEAD^^\
> 前 n 筆: HEAD~n

你可以 `更改 commit message`, `re-order commits`, `squash commits`, `remove commits`\
僅需要在 interactive editor 中將 command 更改並 **儲存退出** 就可以執行操作了，如下圖
```
pick af38288 Fix collaborator's repo
s 45ee847 Fix mv error
pick 31c1b30 Add ignore file
r 8ee234f Fix token clone error
d d223bd6 Update README

...
```
> 你可以使用 short name(e.g. `reword => r`, `drop => d`)

如前所述，在 rebase 的過程中有可能出現 conflict，解決辦法也一樣\
在解決完 conflict 之後執行以下指令即可
```shell
$ git add .
$ git rebase --continue
```

## Execute Command during Rebase
有時候我們會想要確保在 rebase 的過程中 code 沒有被改壞，通常都會跑 test 來確保對吧?\
但是手動執行太費時費力了，rebase 的過程中可以安插 shell command 用以執行 test\
使用方法為在 interactive mode 裡面加入 `exec COMMAND`，如下所示
```
pick af38288 Fix collaborator's repo
pick 45ee847 Fix mv error
pick 31c1b30 Add ignore file
exec make
pick 8ee234f Fix token clone error
pick d223bd6 Update README
```
上述的例子是使用 make(如果你不是使用 Makefile 也可以改成其他指令執行)

## Splitting Commit
其實並沒有甚麼 split commit 的指令啦\
但是我們可以透過 git reset 先把 commit reset 回 staging 的狀態\
然後分次 commit 部分 changes\
如此一來就可以做到類似於 split commit 的作法了
> 詳細的操作可以參考 [Git 進階使用 - Git Reset \| Shawn Hsu](../../git/git-reset#split-commit)

在 rebase 的過程中可以執行上述操作\
就是將要 split 的 commit 在 interactive mode 中改成 `edit command` 即可

# Reference
+ [git-rebase](https://git-scm.com/docs/git-rebase)
+ [git-cherry-pick](https://git-scm.com/docs/git-cherry-pick)
