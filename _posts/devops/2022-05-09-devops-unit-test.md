---
title: DevOps - 單元測試 Unit Test
date: 2022-05-09
categories: [devops]
tags: [unit test]
math: true
---

# Introduction to Testing
在軟體開發的過程當中，QA 測試其實是很重要的一個環節\
有了 QA 驗證，可以確保程式不會因為不當的輸入而產生不如預期的結果

> QA - Quality Assurance\
> 通常泛指 軟體測試工程師

就我所待過得公司，大部分的 **測試** 都是泛指 `手動 QA`\
什麼意思呢？ 就是會有專門的 QA 人員，透過 web UI 或是其他方式手動進行測試\
這會產生一個問題，如果目前系統更新得很頻繁，那 QA 人員會被累死吧\
並且會有很大的機會，會漏掉某些 corner case

所以，你應該嘗試引入所謂的測試\
而這個測試是由 **程式** 撰寫而成的\
亦即 `用程式測試程式`

注意到我不是說手動 QA 沒必要可以廢掉\
而是說，多加一層保障\
RD 自己寫測試同樣會有盲點，手動測試可能可以 cover 到這些, 反之亦然\
有了程式測試以及手動測試，你就可以很有信心的說，我的這個功能八成不會壞掉！

> 其實 測試程式(unit test, integration test) 若以專業分工的角度來說是 QA 要寫的\
> 但在國內我看到的要不是沒有不然就是手動

# Unit Test
單元測試為最基本且最容易實作的測試\
單元測試的目的在於 ***測試 function 的 logic***

所以 unit test 的 scope 僅限於 function 內部\
實際來看個例子吧

假設你有一個 function 是用於計算加法，你想要對它做 unit test\
它寫起來會長這樣

```
func addition(addend int, augend int) int {
	return addend + augend;
}

func test() {
    assert(addition(1,1), 2);
    assert(addition(2, 3), 5);
}
```

在上述 pseudo code，你可以看到我用了一個 assertion 來確保兩個參數的結果是一致的\
如果不一致，它會跳出錯誤\
而這就是 unit test

這麼簡單的嗎？ 當然\
這就是最基本的 unit test 的概念，它只會驗證 function 內部邏輯是否與你預期的一樣而已

## How to do Unit Test in Real World
有的時候，在呼叫 function 之前，你可能必須要做一些必要的初始化動作\
例如 初始化資料庫連線、設定 config 等等的\
這些瑣碎的事情，會無形中增加測試的複雜程度

以 golang [testing](https://pkg.go.dev/testing) package 而言，從 go 1.4 起就有提供類似 `setup` 以及 `teardown` 的作法\
透過實作 `func TestMain(m *testing.M)` 即可以自定義裡面的呼叫邏輯
```go
func TestMain(m *testing.M) {
    setup()
    m.Run()
    teardown()
}
```
不過 TestMain 的 setup, teardown 只會在該 test 當中跑一次而已\
其實這樣是不夠用的 我們會希望每一次的 test 都是互相獨立的(亦即降低其他可能會影響測試結果的因素)\
所以能夠在每一次 test 都重新初始化是最好的\
你可以這樣做
```go
func TestAdd(t *testing.T) {
    setup()
    // do test
    teardown()
}

func TestAddFail(t *testing.T) {
    setup()
    // do test
    teardown()
}
```
不過顯然我們有更好的作法, 目前市面上的 testing framework 都有提供類似的作法\
不會需要自己刻一個底層的邏輯(i.e. 怎麼呼叫 test, 怎麼控制流程 ... etc.)
+ [google/googletest](https://github.com/google/googletest) :arrow_right: C, C++
+ [facebook/TestSlide](https://github.com/facebook/TestSlide) :arrow_right: Python
+ [stretchr/testify](https://github.com/stretchr/testify) :arrow_right: Golang

以 testify 來說\
我們可以使用 `suite` package 來實作\
`SetupTest` 以及 `TearDownTest` 會在每一次的 test 都執行，確保測試之間的相依性降至最低\
為了能夠執行 testify 的內容，我們需要一個程式進入點 `TestMath`, 在這裡初始化

接下來 testify 會遍歷並執行所有名字為 `Testxxxx` 的 function
```go
import (
    "github.com/stretchr/testify/suite"
)

type TestMathSuite struct {
    suite.Suite

    benchmarkLoopCount int
}

func TestMath(t *testing.T) {
    suite.Run(t, new(TestMathSuite))
}

func (suite *TestMathSuite) SetupTest() {
    suite.benchmarkLoopCount = 10
}

func (suite *TestMathSuite) TearDownTest() {}

func (suite *TestMathSuite) TestAdd() {
  // test your function here
}

func (suite *TestMathSuite) TestAddFail() {
  // test your function here
}
```

## What if there's a Function Inside?
當然，在測試的過程中，你的實作幾乎不可能像是上面的加法範例一樣簡單\
它可能包含了許多的 sub-function, 可能是另一個檢查 function 或是 database 相關的
```go
func getUser() (UserResponse, error) {
    ...

    if _, err := isUserLogin(); err != nil {
        panic(err)
    }

    db.GetUser()

    ...

    return user, nil
}
```

這時候如果你要測試的對象包含 sub-function，那麼事情就會有一點點的不一樣\
由於 unit test 的宗旨是 `測試 function 內部的邏輯`\
所以按理來說 sub-function 會有他自己的 testing code\
為避免相依於其他 dependency, 這時候你就需要 `mock`

mocking 可以替代原有的 function 或 object, 使其可以 **模擬原有行為**\
這樣的好處是可以讓我們專注於要測試對象本身的邏輯

> 可參考 [Mock](#mock)

## Mock
當我以為 mock 就只是這樣而已的時候，我發現我錯了\
原來除了 mock 之外還有很多用於測試的 object type\
我把它整理成如下表格，做個紀錄

|Object Type|Description|
|:--|:--|
|Mock|針對不同輸入，**回傳不同輸出**<br>mock 裡面 **不會有實作**|
|Stub|針對不同輸入，**回傳相同輸出**<br>stub 裡面 **會有實作**|
|Dummy|填充目標物件，主要目的是不讓測試掛掉|
|Spy|主要紀錄呼叫次數以及參數設定|
|Fake Object|擁有 **簡單版** 的實作|

# Dependency Inversion Principle
![](https://upload.wikimedia.org/wikipedia/commons/9/96/Dependency_inversion.png)\
在撰寫單元測試的時候，我對依賴反轉這件事有更進一步的認識

前面提到，為了要測試 sub function, 我們可以使用 mock 建構假的物件方便測試\
但是如果你的程式沒有寫好，導致相依性過高，那實作根本沒辦法拆掉，也就會變得難以測試

以我最近遇到的情況，我想要對一塊商業邏輯做測試\
其中，裡面的資料庫實作是完全綁定在 service layer\
也就是說它並沒有使用 interface 來降低各個 object 之間的耦合性\
正確的作法是 ***將依賴的對象從 object 轉換成為 interface***\
最後在使用 [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection) 針對不同的情況使用不同的實作\
在測試的例子當中，就可以將實作抽換成 mock 了

![](/assets/img/posts/dip.jpg)

# Test-Driven Development - TDD
![](https://www.thinktocode.com/wp-content/uploads/2018/02/red-green-refactor.png)

在敏捷開發的方法論裡，有這麼一個模式稱為 `測試驅動開發 Test-Driven Development`\
他的概念是說，在開發功能之前，先寫測試\
一直重複到測試全過

這個概念不僅限於 unit test, 也包含 integration test\
他的概念是透過測試快速得到反饋，以此來建構你的功能

## Steps to Run TDD
1. 分析需求
2. 撰寫 **一個** test case
3. 執行 test case :arrow_right: failed
4. 修改 implementation 讓它可以通過 test case
5. 重構
6. 執行步驟一

為什麼是一次撰寫一個 test case?\
因為 TDD 的目的是要讓你一次專注在一個 test case 上，當然你也可以一次寫完所有 test case\
(只是一次寫完所有情境能享受到 TDD 的好處就會減少，因為你必須一次考慮所有情境，就沒有辦法寫出最 clean 的實作)\
透過不斷的新增修改，你的實作最後會符合所有的需求場景，到此你的功能就開發完成了\
而開發途中產生的 test case 可以當作 unit test 或 integration test 放在 CI/CD pipeline 上面執行，確保每一次的修改都是符合預期的

> 有關 integration test 的介紹可以參考 [DevOps - 整合測試 integration test \| Shawn Hsu](../)\
> 有關 CI/CD pipeline 的介紹可以參考 [DevOps - 從 GitHub Actions 初探 CI/CD \| Shawn Hsu](../../devops/devops-github-action)

## Struggles to Run TDD
通常如果跑不了 TDD 或者說寫不了測試會有幾個問題
+ `Single Responsibility Principle`
    + 要說無法寫測試的最大原因基本上有可能是你的 function 做太多事情(i.e. [God function](https://en.wikipedia.org/wiki/God_object))違反 [Single Responsibility Principle](https://medium.com/%E7%A8%8B%E5%BC%8F%E6%84%9B%E5%A5%BD%E8%80%85/%E4%BD%BF%E4%BA%BA%E7%98%8B%E7%8B%82%E7%9A%84-solid-%E5%8E%9F%E5%89%87-%E5%96%AE%E4%B8%80%E8%81%B7%E8%B2%AC%E5%8E%9F%E5%89%87-single-responsibility-principle-c2c4bd9b4e79) 的原則
    + 一個 function 耦合度太高會導致你無法切割邏輯，讓整個測試變得很困難
    + 最後就導致你的測試寫的亂七八糟
+ `Waste of Time`
    + 撰寫測試程式的確會導致開發速度減緩，但這只是表象
    + 有了測試，你每一次的更動都不用擔心會不小心把 code 改壞
    + 算上程式品質，你撰寫的測試是有用的

# References
+ [软件敏捷开发 TDD 方案](https://cloud.tencent.com/developer/article/1494387)
+ [使人瘋狂的 SOLID 原則：單一職責原則 (Single Responsibility Principle)](https://medium.com/%E7%A8%8B%E5%BC%8F%E6%84%9B%E5%A5%BD%E8%80%85/%E4%BD%BF%E4%BA%BA%E7%98%8B%E7%8B%82%E7%9A%84-solid-%E5%8E%9F%E5%89%87-%E5%96%AE%E4%B8%80%E8%81%B7%E8%B2%AC%E5%8E%9F%E5%89%87-single-responsibility-principle-c2c4bd9b4e79)
+ [Testing in Go: Mocking MVC using Testify and Mockery](https://medium.com/@thegalang/testing-in-go-mocking-mvc-using-testify-and-mockery-c25344a88691)
+ [Test Doubles — Fakes, Mocks and Stubs.](https://blog.pragmatists.com/test-doubles-fakes-mocks-and-stubs-1a7491dfa3da)
+ [Unit Test 中的替身：搞不清楚的Dummy 、Stub、Spy、Mock、Fake](https://medium.com/starbugs/unit-test-%E4%B8%AD%E7%9A%84%E6%9B%BF%E8%BA%AB-%E6%90%9E%E4%B8%8D%E6%B8%85%E6%A5%9A%E7%9A%84dummy-stub-spy-mock-fake-94be192d5c46)
+ [How can I do test setup using the testing package in Go](https://stackoverflow.com/questions/23729790/how-can-i-do-test-setup-using-the-testing-package-in-go)
+ [Dependency inversion principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
