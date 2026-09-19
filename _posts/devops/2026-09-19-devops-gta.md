---
title: DevOps - 利用 gta 加速你的 Integration Test
date: 2026-09-19
categories: [devops]
description: 測試跑太久總是讓人抓狂？本文以 Kubernetes 專案為例，深入探討測試影響分析（TIA）的概念，並手把手教你如何使用 Go 靜態分析工具 gta 精準鎖定受影響的 Package，告別冗長的 CI 等待時間。
tags: [integration test, unit test, test, ci, ci/cd, ci pipeline, transaction rollback, disposable container, git, git diff, only changed, test impact analysis, TIA, dynamic analysis, static analysis, runtime, gta, digitalocean, go list, function-level, package-level, kubernetes]
math: true
---

# How You Write, How it Runs
在我待過的所有公司裡，我都致力於導入自動化測試\
讓原本不穩定的系統不再那麼常出錯

但後來我發現了一件事情\
就是很多人，也對於我來說，我們都很沒有耐心\
`unit test` 跑個幾分鐘可能都還可以接受\
但是當 `integration test` 隨著 test case 數量的增長，動輒數小時的測試\
真的沒有人可以忍受

> `unit test` 可以參考 [DevOps - 單元測試 Unit Test \| Shawn Hsu](../../devops/devops-unit-test)\
> `integration test` 可以參考 [DevOps - 整合測試 Integration Test \| Shawn Hsu](../../devops/devops-integration-test)

CI pipeline 通常是確定完新的 code change 通過所有測試才會進行合併\
畢竟你沒跑完就 merge 萬一程式有錯，就喪失了 CI/CD 的意義

> 如果是合併之後才出現錯誤這當然是另當別論

這時候，你怎麼寫測試其實會很大程度的影響他的執行時間\
那既然我們都不想等，是不是可以考慮優化這段？

> 有關 CI/CD 可以參考 [DevOps - 實作你自己的 GitHub Actions \| Shawn Hsu](../../devops/devops-github-action)

# Different Approach with Integration Test
怎麼寫測試是啥意思？

當然我這裡指的是跑 `integration test`\
因為要真正的去跟不同的服務做 **整合**\
通常是用 container 的方式去使用

問題很常出現在這段，[Rollback Transaction](#rollback-transaction) 與 [Disposable Container](#disposable-container)\
不同方式造成的差距可大了

## Rollback Transaction
這個方式主要是針對使用資料庫，將操作本身以 *Transaction* 的方式執行\
要馬全部執行成功，要馬全部失敗

> 有關 Transaction 可以參考 [資料庫 - Transaction 與 Isolation \| Shawn Hsu](../../database/database-transaction)

對於測試來說，你可以在每個測試的結尾都使用 `Rollback` 這個方法將 *Transaction* 把剛剛寫上去的更新都弄回去\
這樣做的好處就是，當測試跑完的時候，你的資料庫 container 還是乾淨的

可是並不是所有東西都能夠這樣弄\
你想嘛，你有可能只跑 **資料庫** 嗎?\
給你個例子好了，目前我司在跑 integration test 的時候\
需要同時啟動
1. 資料庫
2. message queue
3. 身份認證系統
4. ...等等 container


那你說 mq 不用 `Rollback`，這當然是正確的\
但身份認證系統勒？ 他可沒有 `Rollback` 哦，你需要手動把你剛寫進去的資料刪掉

所以，縱使 [Rollback Transaction](#rollback-transaction) 可以以簡單的方式清除資料\
但他的使用場景是非常受限的\
為了快那麼一點點你要手動清除資料，顯然是不太划算的？

## Disposable Container
所以另一種常見的，是每一個測試你都使用獨立的 container\
這個測試用完就丟，下一個測試再開一個新的 container 來用

省事的代價就是這種方法效率是非常低下的\
每次開關 container 造成的 overhead 會隨著測試數量變多而變多

# Run Tests with Only Changed Code
有時候可能因為 legacy code 的關係你沒辦法用 [Rollback Transaction](#rollback-transaction) 的方法\
就是比如說，他可能根本就沒有寫 Transaction 之類的導致架構上你短時間內動不了\
又或者是上述我們提到的，他根本不是資料庫

既然這樣，你只能把眼光放在 [Disposable Container](#disposable-container) 上面\
既然我不能減少測試的數量(i.e. container 的數量)\
那我減少測試的數量行不

不是啦我不是說把測試刪掉，但也接近\
就是我 **只跑有被改到的程式碼相關的測試**

## Transitive Dependents
但我要怎麼找 **只跑有被改到的程式碼相關的測試** ？

單純的去看 `$ git diff` 可不行\
你改到的 function 可能存在於其他 function 很深層的呼叫鏈\
所以單純看 diff 不行，你要有一個工具去看 call stack\
把相依圖畫出來，找出來實際相依，然後再執行那些被影響到的測試

# Test Impact Analysis
相依圖怎麼畫？

實務上我們會用一個叫做 `Test Impact Analysis` 的技巧\
目的就是為了要解決只跑跟這次修改有關的測試而已\
但具體來說要怎麼做？

TIA 的實作方式分為兩種 [Dynamic Analysis](#dynamic-analysis) 以及 [Static Analysis](#static-analysis)

||[Dynamic Analysis](#dynamic-analysis)|[Static Analysis](#static-analysis)|
|:--|:--:|:--:|
|準確度|高|低|
|分析速度|慢|快|
|執行程式碼構建相依圖|:heavy_check_mark:|:x:|
|週期性重建相依圖|:heavy_check_mark:|:x:|

## Dynamic Analysis
動態分析就是把程式碼跑起來，然後把分析圖畫出來

相依圖在 runtime 階段是確定的\
單純看程式碼(i.e. [Static Analysis](#static-analysis))是決定不出來的

> 或者說還是畫得出來，只是準確率不高

動態分析具體的做法就是在各個 function 插入一些程式碼\
就是說，`哦 我現在正在執行 func foo()` 這種東西(稱為 *instrument*)\
然後你把程式執行一遍，把這些相依圖建立起來

等到你要用的時候\
根據你這次的修改，去反查之前做好的相依圖，把影響範圍抓出來\
只針對這部分進行測試

這些相依圖的構建是很費時費力的\
所以一般來說我們並不會每次跑測試的時候才去 build 相依圖\
他可能是每週重建一次，這樣的 trade offs 就是每次跑測試他不一定是準確的\
就是會漏東西啦，不過考慮到執行成本跟換來的速度相比，是可以接受的\
而且他不是不能解決的，你在正式出版之前肯定是需要完整測試過全部的 test case\
so it's not a big deal

## Static Analysis
那靜態分析就很簡單了，我單純的去看程式碼本身，推導出相依圖\
但要注意到的是，靜態分析通常準確度會不如 [Dynamic Analysis](#dynamic-analysis)
不準的原因是

+ 程式動態輸入資訊
+ function callback
+ if else branch 執行期才能確定

那我就好奇了\
為什麼當 Golang 跑出一個 nil pointer exception 的時候 call stack 那麼準確\
為什麼不能直接拿來用?

因為這是 `runtime` 的結果，並非靜態分析得出的

# gta
[digitalocean/gta](https://github.com/digitalocean/gta) 是一套 Golang 的 [Static Analysis](#static-analysis) 工具

它的核心分為兩個部分
1. 第一是用 git 抓出更改的檔案
2. 然後用 `$ go list` 抓出相依的 package

package?\
沒錯，注意到 gta 並不是做 function-level dependents graph\
他是抓 **package-level dependents graph**\
所以你雖然可以預期他能夠減少一些 test case 執行的數量，不過 golang package 裡面通常包滿多東西\
跑起來還是比純 [Dynamic Analysis](#dynamic-analysis) 還要花時間的(但還是比較快的)

> 而且 README 裡面也寫得很清楚\
> List `packages` that should be tested since they have deviated from master.

## Experiment
使用其實也非常簡單，他本質上就是個 cli 工具\
這邊我就比較隨意的用 [kubernetes/kubernetes](https://github.com/kubernetes/kubernetes) 來做演示就好

### Installation
首先依然是安裝
```shell
$ go install github.com/digitalocean/gta/cmd/gta@latest
```

然後把 k8s repo clone 下來
```shell
$ git clone https://github.com/kubernetes/kubernetes.git
```

### Code Change
接下來來改個東西觀察一下

![](/assets/img/posts/gta-1.png)

我挑了一個應該是 share library 的 code 來改\
啊然後記得要把它 commit

> 要 commit 才會抓得到，目前 gta 不支援還沒 commit 的

<hr>

{% raw %}
然後 README 上面原本是說要這樣用
```shell
$ gta -include "$(go list -f '{{ .Module.Path }}')/"
```
{% endraw %}

我一直跑不出來，就是會錯
![](/assets/img/posts/gta-3.png)

我後來看了很久，發現到說，因為在專案根目錄是沒有 Go file 的\
所以他會錯\
那其實 `-include` 的目的主要其實就是要過濾掉檔案而已\
以這個例子來說，我們就是只要 `k8s.io/kubernetes/*` 這種 prefix 的而已

![](/assets/img/posts/gta-2.png)

{% raw %}
我後來其實是把指令改成這樣
```shell
$ gta -include "$(go list -f '{{ .Module.Path }}' ./... | head -n 1)/"
$ gta -include "k8s.io/kubernetes"
```
{% endraw %}

這兩個指令在這個情況下是等價的\
所以跑完長這樣

![](/assets/img/posts/gta-4.png)

你說，我要怎麼知道他真的有用\
我跑了 package 數量的確認

```shell
$ go list ./... | wc -l
1471
$ gta -include "k8s.io/kubernetes" | wc -l
39
```

那你就可以看到，確實，這邊只列出受影響的 package\
我原本要跑 *1471* 個 package 的測試，縮減到 *39* 個 package 測試\
時間上可以預期大幅度的縮減\
接下來你就可以依照這些列出的 package 跑測試了

```shell
$ go test $(gta -include "k8s.io/kubernetes")
```

# References
+ [digitalocean/gta](https://github.com/digitalocean/gta)
