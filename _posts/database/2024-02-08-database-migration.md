---
title: 資料庫 - 新手做 Data Migration 資料遷移
date: 2024-02-08
description: 隨著產品的不斷迭代，資料搬遷是一個不可避免的議題。本文將會介紹資料搬遷的一些基本觀念，以及一些可能會遇到的問題
categories: [database]
tags: [data migration, sql, prisma]
math: true
---

# Preface
資料搬遷，在現代軟體服務當中屬於較為常見的一種需求\
不論是單純的機器之間的搬資料抑或者是因應商業邏輯而需要做的資料搬遷\
都是屬於 Data Migration

本文將會專注在資料本身的 Migration\
也就是因應商業邏輯的調整

# Introduction to Data Migration
![](https://www.prisma.io/blog/posts/2020-12-migrate-production-workflow.png)
> ref: [Hassle-Free Database Migrations with Prisma Migrate](https://www.prisma.io/blog/prisma-migrate-ga-b5eno5g08d0b)

有的時候，你可能會需要針對資料庫的某個欄位做些微的更動\
比如說，增加 unique constraint 或者是設置 default value\
這些，其實就是資料搬遷的一種

以 [Prisma](https://www.prisma.io/) 來說\
每一次的搬遷，它都會新增一筆新的 entry\
針對該欄位的更新 sql 就會寫在裡面

<hr>

不過這仍然是較為簡單的狀況\
真實世界可複雜的多\
商業邏輯的改變，資料搬遷的功會比想像中的多

比如說\
我們想要仿造 Youtube 的開啟小鈴鐺的功能，使用者可以自由切換要不要開啟通知\
因為我們已經有使用者正在使用我們的服務了\
所以針對 **舊有的使用者**，我們必須讓它也可以使用這個功能\
所以我們需要針對這些舊有用戶，幫他們新增預設的通知設定

> 新的使用者，因為初始化的時候已經做了，所以不需要包含在這次的搬遷內容裡面

# Preparation
既然你已經知道你要針對哪一個部份做資料搬遷了\
你需要做哪一些準備工作呢？

## Backup
因為這種商業邏輯的資料搬遷往往伴隨著一定程度的危險\
所以做好備份的工作是必要的

最壞的狀況就是，當資料搬遷出了大問題\
你已經沒辦法挽回的時候，至少還有一個拯救的辦法

不過要注意的是，當系統升級完成但搬遷卻失敗\
使用 backup 復原並不是一個好的辦法\
因為你需要考慮到回復會不會造成系統相容性的問題等等的\
有沒有 **向後相容**？ 它會不會造成現有服務運作異常\
這個問題值得思考

## Verify Business Requirement
除了技術方面，你還得要確認商業邏輯的部份\
他是不是符合公司的要求

如果條件允許，也必須提及此次系統更新可能的影響\
包含它是否商業上可行？ 會不會與未來的規劃有衝突等等的

# How to do Data Migration?
仔細想想其實也就兩種

1. 手動升級
2. 自動化升級

其中手動升級是較為不推薦的作法\
如果沒有適當的文件，它可能會難以維護\
甚至你可能會忘記為什麼這個欄位會是這個數值

自動化升級至少你還有 code 可以查看\
而自動化的部份，你可以單純寫 SQL 或者是使用類似 [Prisma](https://prisma.io) 這種工具幫你解決\
如果遇到複雜的商業邏輯的部份，則可能要寫個小程式執行

# Possible Issues
## Data Loss
執行資料搬遷，我們絕對不希望它更改到其他不相干的部份\
但它仍然是可能會發生的，所以測試是必要的

針對你搬遷的部份，建立幾筆資料觀察它執行的結果\
在上到 production 之前，可以在 dev 以及 staging 環境測試\
我個人會推薦，在這些之前，也可以在本機進行測試

## Long Migration Time
當搬遷的資料數量過於龐大\
花超過額外預期的時間是有可能會發生的

資料庫系統的更新，因為會佔用一定的連線數量，以及一定的 I/O\
系統的反應速度可能會變慢

為了系統的可用性，我們通常會希望系統的 down time 越低越好\
盡可能的提高使用者體驗

你可以借助現有第三方的資料搬遷服務，降低此種意外的方法\
或者是可以選擇在半夜這種不會有太多使用者在線上的時候，執行系統升級

## Idempotent
最後也是最重要的一點，你的自動化搬遷的執行檔案\
它必須要滿足 `Idempotent` 的條件

何謂 Idempotent？ 就是你不管執行幾次，它得到的結果都要是一致的\
比如說上面我們提到想要實作使用者的通知設定功能\
你絕對不會希望一個使用者有多個相同設定

因此，在設計 migration script 的時候，他要執行的是 `upsert`\
若是寫入的資料不存在，寫入，若存在，則略過或更新部份值\
以 [PostgreSQL](https://www.postgresql.org/) 來說\
你可以使用
```sql
INSERT INTO (xxx) VALUES(yyy) ON CONFLICT(zzz) DO UPDATE SET id = EXCLUDED.id
```
當你寫入的資料，有比對到一模一樣的資料的時候，它就會選擇使用原本的 id\
而這個比對的基礎，是寫在 `ON CONFLICT` 裡面

注意到，一模一樣的資料的定義是，它必須擁有 unique constraint 進行保護\
有時候你要 upsert 的資料根本沒有 unique constraint\
這時候其實你別無選擇，你只能先 query 有沒有該筆資料的存在，然後在寫入\
當然這時候，使用 `transaction` 是相對比較好的選擇

> 有關 transaction 的討論，可以參考 [資料庫 - Transaction 與 Isolation \| Shawn Hsu](../../database/database-transaction)

# References
+ [Hassle-Free Database Migrations with Prisma Migrate](https://www.prisma.io/blog/prisma-migrate-ga-b5eno5g08d0b)
+ [What is data migration?](https://www.ibm.com/topics/data-migration)
