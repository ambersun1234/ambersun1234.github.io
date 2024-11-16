---
title: 網頁程式設計三兩事 - 基礎權限管理 RBAC, ABAC 與 PBAC
date: 2024-08-06
categories: [website]
description: 龐大的系統架構下要如何有效率的進行權限的管理是值得程式設計師們共同思考的問題，本篇文章將會帶你學習權限管理的基礎概念，以及如何透過 Casbin 來實作權限管理
tags: [permission, acl, rbac, abac, pbac, casbin, permission granularity]
math: true
---

# Brief Permission Management
權限管理在現今的網頁系統中是個很重要的議題\
拿你我都熟悉的社群軟體來說，其實你無意中已經接觸過權限管理了

![](https://www.thesocialginger.com/wp-content/uploads/2022/08/Screen-Shot-2022-08-31-at-6.38.56-AM.jpg)
> ref: [Private vs. Public: Who’s actually seeing your posts on Facebook?](https://www.thesocialginger.com/private-vs-public-whos-seeing-what-when-you-post-to-facebook/)

平常在發布文章的時候，你可以選擇是公開發布還是私人發布\
這就是一個基本權限的概念\
透過指定的權限，來控制使用者對於資源的存取

## Access Control List (ACL)
所以從上述的例子，我們可以想出一個權限的表達的方式\
身為作者的自己，所擁有的權限應該要是 read, write\
其他人的權限，針對私有文章，只能有 read

```text
ambersun1234: READ, WRITE
alice: READ
bob: READ
```

把這些整合在一起\
就可以組成所謂的 Access Control List\
ACL 通常是針對特定的資源(文章)，指定特定的權限

# Why ACL is Not Enough?
你不難發現，ACL 其實是依據 `資源` 以及 `使用者` 來做權限的控制\
這其實會造成一些管理的問題, 比如說\
使用者數量增加，每一個使用者都要有自己的權限表\
即使 Alice 跟 Bob 同樣都只有 READ 的權限，但是他們的權限表還是要分開

可以想像，當使用者數量遞增，你的權限表也會變得越來越大\
API 回傳的資料也會變得越來越大\
最後造成效能瓶頸，這很明顯不是一個好的方向

# Role-Based Access Control (RBAC)
RBAC 相比於 ACL，是一個更為彈性的權限管理方式\
既然瓶頸是在於使用者數量增加，有沒有一種方法可以不要強制綁定使用者與權限的關係呢？

重點在使用者數量太多了，管理太麻煩\
當我想要把私有文章轉成公開文章的時候，我需要去 **一個一個的修改使用者的權限**\
這會對資料庫造成很大的 overhead, 等於你在 DDOS 他

所以權限之間的關係勢必還是要存在，只是需要簡化\
同一個資源下，擁有同一種權限的使用者，多半具有共同的特性\
我們可以把他歸類成同一群，比如說 **管理員**、**一般使用者**\
透過中間插入一層中間層，抽象化 `使用者` 與 `權限` 之間的關係\
使得你不必明確的指定權限關係，這層中間層就是 `角色`

只有特定角色的使用者，可以擁有特定的權限\
這點也不是什麼新鮮的東西

> 學生可以進入學校，我是學生，所以我可以進入學校\
> 就是個簡單的例子

> 注意到 RBAC 可以擁有多個角色

# Attribute-Based Access Control (ABAC)
以上述學校的例子來說，我可能會身兼多種角色
+ 我可以是 `資工系` 的學生
+ 我可以是 `總務處` 的工讀生

所以一個使用者可能會擁有多個角色，在特定的情況下，我擁有這些角色的權限\
當我還是學生的時候，我可以進入學校\
當我是總務處的工讀生的時候，我可以進入總務處辦公室存取機密資料

這些權限都不是固定的\
什麼意思？\
當我不在學校，就不能使用教室的電腦\
當我畢業的時候，我就不能進入學校\
當我工讀生的工作結束的時候，我就不能進入總務處辦公室存取資料了

你會發現你的權限是動態的\
以上述的例子來看，他會根據你的 `地點` 以及 `時間` 來做權限的控制

ABAC 的概念是，一個使用者擁有多個 `屬性`, 而非角色\
你可以是
+ 台大的學生
+ 資工系的學生
+ 總務處的工讀生
+ 多媒體網路實驗室的研究生
+ xx 專案的工程師

要進入多媒體網路實驗室，你需要是
1. 台大的學生
2. 資工系的學生
3. 多媒體網路實驗室的研究生

擁有相對應的屬性你就擁有相對應的權限\
這就是 ABAC 的概念

ABAC 對於 **顆粒度較小的權限**(如特定實驗室的權限) 是比較好的選擇\
如果使用 RBAC 你需要的角色數量就會變得很多，顯然不是一個好的選擇\
透過修改屬性，你的權限就會相對應的啟用\
所以 ABAC 適用於權限需要頻繁更動，較為動態複雜的情況

> 有關權限顆粒度的問題，可以參考 [Permission Granularity](#permission-granularity)

# Policy-Based Access Control (PBAC)
PBAC 的概念其實跟 [ABAC](#attribute-based-access-control-abac) 差不多\
只是把 attribute 換成 policy

上述的例子改寫一下就是 policy 了
+ 台大的學生 :arrow_right: 只有台大在籍的學生可以進入校園

> 與 ABAC 一樣，PBAC 透過組合不同的 policy 來控制權限

> ABAC 可以說是 PBAC 的一個實作方式

# Permission Granularity
權限的粒度是很重要的\
粒度的大小會直接影響到你的權限管理的複雜度\
為什麼說顆粒度太小/太大會對權限設計有影響

顆粒度大的情況指的是，他的使用範圍太大\
Admin 可以讀取所有 Admin 的資料\
但是不同的 Admin(行政部門，銷售部門) 他們可以看到的東西理論上應該要不一樣\
所以當你都把他們歸類成 Admin 的時候，就會造成權限的混亂

這時候你需要調整你的權限粒度，讓他們可以更細緻的控制權限\
比方說 [ABAC](#attribute-based-access-control-abac) 的概念，你可以透過屬性來控制權限\
顆粒度變小你可以設定的邊界就能夠更明確

RBAC 與 ABAC 各有優缺點\
其中權限的顆粒度是最為顯而易見的重點\
適用何種情況取決於系統的複雜程度以及需求

# Casbin
## PERM Metamodel
無論 [RBAC](#role-based-access-control-rbac) 或者是 [ABAC](#attribute-based-access-control-abac) 都是一種權限的管理方式\
他們都可以使用一種方式來表達權限\
在高層次的角度來看，他們其實都符合 [PBAC](#policy-based-access-control-pbac) 的概念\
在 Casbin 中，稱為 PERM Metamodel

**一個使用者需要存取特定的資源，他需要根據現有的 policy 判斷是否有權限**\
這句話構成 PERM Metamodel 的基礎

我需要有 policy 定義誰可以存取什麼資源\
我需要有 request 定義為存取資源的請求\
定義 matcher 來判斷 request 是否符合 policy\
最後 effect 來判斷是否允許存取

> 注意到你可以擴展 PERM Metamodel 來符合你的需求\
> 比如說 policy 跟 request 之間可以再做一層 role 的映射

<hr>

舉例來說

`admin` 可以 `讀取` `data1` 的資料\
這是一個 **policy**

`admin` 需要 `讀取` `data1`\
這是一個 **request**

要如何判斷以上 request 能不能執行？\
你可以自己寫個判斷的 function\
當 role 符合，動作符合以及資源符合的時候，就回傳 true\
這就是 **matcher**

> 當 matcher 找到符合的 policy\
> 他會回傳 policy result(`.eft`)

> 如果 policy 沒有定義 `.eft`，則預設為 `allow`

effect 是一個很神奇的東西\
既然 matcher 已經找到符合的 policy 那為什麼還需要 effect 呢？\
因為你可能會符合多個 policy\
effect 裡面可以指定全部符合或部分符合

```text
# Request definition
[request_definition]
r = sub, obj, act

# Policy definition
[policy_definition]
p = sub, obj, act

# Policy effect
[policy_effect]
e = some(where (p.eft == allow))
// 只要有一個 policy 允許存取，就允許存取

# Matchers
[matchers]
m = r.sub == p.sub && r.obj == p.obj && r.act == p.act
// 當請求主體相同，對象相同以及動作相同時，則允許存取
```
> ref: [How It Works](https://casbin.org/docs/how-it-works)

# References
+ [Access-control list](https://en.wikipedia.org/wiki/Access-control_list)
+ [屬性存取控制（ABAC）為何？](https://zh.oosga.com/docs/attribute-based-access-control/)
+ [What is RBAC vs ABAC vs PBAC?](https://www.styra.com/blog/what-is-rbac-vs-abac-vs-pbac/)
