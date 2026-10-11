---
title: 設計模式 101 - MVC 已死？ AI Agent 需要的是 Vertical Slice 架構... 嗎？ 
date: 2026-10-11
categories: [design pattern]
tags: [mvc, model, view, controller, router, service, agentic coding, ai agents, vertical slice, vertical slice architecture]
description: 面臨 AI Agents 的時代，我們所熟知的 MVC 架構是否已經過時，甚至面臨架構升級的必要性？ 本文會以此為中心，探討 AI Agents 是不是真的需要架構升級
math: true
---

# What is MVC
我們早期在寫後端程式的時候，多半都會遵循所謂 `MVC` 架構\
即 Model View Controller

MVC 架構之所以能夠統治這麼久的一段時間，很重要的原因在於這種架構設計上很符合人類直覺

當你想要修改程式碼，你能夠很輕易的找到要修改的部份\
你想改路由？ 找到 router 東西都在那\
你想要改資料？ 找到 service 即可

![](https://miro.medium.com/v2/resize:fit:640/format:webp/1*jVhPsneY2Q7YqlKYKxXr4A.png)
> ref: [Vertical Slice Architecture](https://medium.com/@iamprovidence/vertical-slice-architecture-e3b7b8f48ce9)

東西的編排組成都是以人類最容易的讀懂的方式進行組織\
所以 MVC 才能夠經久不衰

## Why MVC is Bad for AI Agents
不過在現在 Agentic Coding 如此盛行的情況下，有些人開始質疑 [MVC](#what-is-mvc) 的架構是否過時

既然現在，閱讀程式碼 撰寫程式碼等等的工作都是給 AI Agent 執行\
是不是應該進行架構升級，讓 AI Agent 能夠更輕易的與 codebase 互動

至於說 [MVC](#what-is-mvc) 為什麼不適合\
網路上的說法是，AI 的 context window 有限，[MVC](#what-is-mvc) 分散的特性使得每次工作都要載入一大堆不同的 codebase\
所以 context 就稍微髒掉，進而降低模型的處理能力

# Introduction to Vertical Slice Architecture
`Vertical Slice` 的架構方式屏棄了 [MVC](#what-is-mvc) 的分層架構\
取而代之的是以 **功能** 組成的架構方式

![](https://miro.medium.com/v2/resize:fit:640/format:webp/1*W8svvnYB8Qf_H7nM9nIsvg.png)
> ref: [Vertical Slice Architecture](https://medium.com/@iamprovidence/vertical-slice-architecture-e3b7b8f48ce9)

把每個功能都牢牢的綁在一起的好處有
1. 你的所有改動都在同一個地方完成
2. 把其他東西改壞的機率變低，因為他是用功能切分
3. 多人協作衝突降低，每個人都有各自的資料夾可以獨立工作

![](https://miro.medium.com/v2/resize:fit:640/format:webp/1*or8EPE4bfVPYnxScZNZBtg.png)
> ref: [Vertical Slice Architecture](https://medium.com/@iamprovidence/vertical-slice-architecture-e3b7b8f48ce9)

當然也有壞處
1. 你需要自己決定 "功能" 的邊界到底在哪，才能正確切分
2. 因為功能是獨立的，重複的 code 可能會多很多

## VSA for AI Agents
所以這意味著什麼，對於 AI Agents 來說顯然這種架構明顯更好\
東西全部都在同一個地方，context window 塞滿了必要且正確的資訊\
它其實是更符合 AI Agents 的工作方式

# Who Reads the Code
計算機科學在近幾年發展的滿快的，尤其是最近兩三年\
大家都還是在隨著這波逐步的適應更改方法

VSA 無疑是對 AI Agents 來說更容易協作的架構\
不過，出問題的時候，要解決的人到底是你還是 AI

## Code Quality still Matter?
我想表達的是，當 AI 已經可以做掉幾乎全部你的工作的時候\
工程師的價值已經蕩然無存，你曾經在乎的 clean code、品味以及 legacy code 都不是那麼重要\
有足夠多的錢，幾個小時甚至幾天，所有你擔憂的都能夠被整理完畢\
我們剩下的就只是從旁協助的功能

至於說程式碼品質到底好不好，我想在這個時代，重要性逐步降低

## "This was written by AI, not by me." Phenomenon
我大概在工作上聽過不少次，`這東西是 AI 寫的不是我`\
無論是出於何種原因，既然是你提交的，責任就在你身上

當功能出錯的時候將責任歸咎於 AI 就是你無能的表現\
你要有能力去管理 AI 的產出，至少在它出錯的時候你知道為什麼

# Your Responsibility, Your Code
只要 AI 還不能扛責任，你提交的 code change 你就有責任看懂它\
回到我們這裡在講的，[MVC](#what-is-mvc) 真的死了嗎？ 其實不是重點

不論架構演變成什麼樣的狀態，身為工程師，你有職責把東西把關好\
你想讓架構變 [MVC](#what-is-mvc)，就要承擔 AI 稍微變笨一點的狀況\
採用 [VSA](#introduction-to-vertical-slice-architecture)，你就要確保你自己看得懂

# References
+ [給 Agent 一把手術刀：垂直切片架構（Vertical Slices）與小表面積測試](https://carlstack.gravito.dev/blog/vertical-slices-tracer-bullets/)
+ [Vertical Slice Architecture](https://medium.com/@iamprovidence/vertical-slice-architecture-e3b7b8f48ce9)
