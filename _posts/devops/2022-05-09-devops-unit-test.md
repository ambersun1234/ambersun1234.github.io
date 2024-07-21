---
title: DevOps - 單元測試 Unit Test
date: 2022-05-09
description: 測試在軟體開發當中是很重要的一環，它可以確保程式不會因為不當的輸入而產生不如預期的結果。本文將會介紹單元測試的基本觀念，並且提供一些簡單的例子
categories: [devops]
tags: [unit test, mock, TDD, dependency injection]
math: true
---

# Introduction to Testing
在軟體開發的過程當中，QA 測試其實是很重要的一個環節\
有了 QA 驗證，可以確保程式不會因為不當的輸入而產生不如預期的結果

> QA - Quality Assurance\
> 通常泛指 軟體測試工程師

就我所待過的公司，大部分的 **測試** 都是泛指 `手動 QA`\
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

```js
const addition = (addend, augend) => {
    return addend + augend
}

const testAddition() => {
    expect(addition(1, 1)).toEqual(2)
    expect(addition(2, 3)).toEqual(5)
}
```

在上述 pseudo code，你可以看到我用了一個 expect 來確保兩個參數的結果是一致的\
如果不一致，它會跳出錯誤\
而這就是 unit test

這麼簡單的嗎？ 當然\
這就是最基本的 unit test 的概念，它只會驗證 function 內部邏輯是否與你預期的一樣而已

## How to do Unit Test in Real World
有的時候，在呼叫 function 之前，你可能必須要做一些必要的初始化動作\
例如 初始化資料庫連線、設定 config 等等的\
這些瑣碎的事情，會無形中增加測試的複雜程度

以 [Jest](https://jestjs.io/) 來說你可以這樣寫
```js
it("should return 2", () => {
    setup()

    expect(...).toEqual(...)

    teardown()
})
```
不過 setup, teardown 只會在該 test 當中跑一次而已\
其實這樣是不夠用的 我們會希望每一次的 test 都是互相獨立的(亦即降低其他可能會影響測試結果的因素)\
所以能夠在每一次 test 都重新初始化是最好的\
你可以這樣做
```js
it("should return 2", () => {
    setup()

    expect(...).toEqual(...)

    teardown()
})

it("should return 5", () => {
    setup()

    expect(...).toEqual(...)

    teardown()
})
```
不過顯然我們有更好的作法, 目前市面上的 testing framework 都有提供類似的作法\
不會需要自己刻一個底層的邏輯(i.e. 怎麼呼叫 test, 怎麼控制流程 ... etc.)
+ [google/googletest](https://github.com/google/googletest) :arrow_right: C, C++
+ [facebook/TestSlide](https://github.com/facebook/TestSlide) :arrow_right: Python
+ [stretchr/testify](https://github.com/stretchr/testify) :arrow_right: Golang
+ [Jest](https://jestjs.io/) :arrow_right: JavaScript

[Jest](https://jestjs.io/) 提供了一種簡單的方法\
也就是使用 `beforeEach` 以及 `afterEach`\
他的行為跟字面上的意思一樣，就是在每一個測試執行之前/之後，額外做一些事情\
確保測試之間的相依性降至最低\
為了能夠執行，我們需要一個程式進入點 `describe`, 在這裡初始化

```js
describe("Test Addition", () => {
    beforeEach(() => {
        // setup test
    })

    afterEach(() => {
        // teardown test
    })

    it("should execute successfully with addition", () => {
        // test your function here
    })

    it("should return error with addition", () => {
        // test your function here
    })
})
```

## What if there's a Function Inside?
當然，在測試的過程中，你的實作幾乎不可能像是上面的加法範例一樣簡單\
它可能包含了許多的 sub-function, 可能是另一個檢查 function 或是 database 相關的
```js
const getUser = async (userID) => {
    ...

    if (!db.isUserLogin(userID)) {
        return null
    }

    return db.getUser(userID)
}
```

這時候如果你要測試的對象包含 sub-function，那麼事情就會有一點點的不一樣\
由於 unit test 的宗旨是 `測試 function 內部的邏輯`\
所以按理來說 sub-function 會有他自己的 testing code\
為避免相依於其他 dependency, 這時候你就需要 `mock`

mocking 可以替代原有的 function 或 object, 使其可以 **模擬原有行為**\
這樣的好處是可以讓我們專注於要測試對象本身的邏輯

> 可參考 [Test Double](#Test-Double)

# Test Double
雖然常常講要 mock 這個 mock 那個\
不過人家的正式名稱是 `Test double`(測試替身)

## Type
![](https://yu-jack.github.io/images/unit-test/unit-test-best-practice-12.png)

Test Double 以功能性分為兩派 [State Verification](#state-verification) 以及 [Behaviour Verification](#behaviour-verification)

### Verification Type
#### State Verification
狀態，指的是系統內的狀態\
軟體工程裡系統的狀態通常是 variable, object properties 等等

通俗點說，你的變數狀態在經過一系列的操作之後，必須要符合某種狀態\
比如說一個計算器，當前數值為 10\
當我進行加法 +1 的時候，它應該要變成 11\
這就是狀態驗證

而 Stub 類型多以模擬狀態(資料)為主

#### Behaviour Verification
這裡的行為就指的是，你的運行過程，狀態遷移的 **過程** 合不合理\
像是他有沒有跟對的 component 互動

符合這個類型的，歸類在 Mock 類型裡面，以模擬行為為主

<hr>

Test Double 內部又分五個種類

+ `Dummy`
    + 用於填充目標物件(i.e. 參數)，僅僅是為了不讓測試掛掉的作用
+ `Fake Object`
    + 較為 **簡單版本** 的實作
    + 比如說用 in-memory database 取代原本的 MySQL 之類的
+ `Stub`
    + 根據不同的輸入，給定相對應的輸出
+ `Spy`(Partial Mock)
    + 原本的定義是用以監看，各種被呼叫的實作的各項數據(被 call 了幾次, 誰被 call) :arrow_right: 跟間諜一樣
    + 有時候也指 Partial Mock, 不同的是，只有實作中的 **部份內容** 被替代
+ `Mock`
    + 跟 `Stub` 一樣，此外還包含了 [Behaviour Verification](#behaviour-verification)

整理成表格的話就如下

|Object Type|Have Implementation|Verification Type|
|:--|:--:|:--:|
|Dummy|:x:|[State Verification](#state-verification)|
|Fake Object|:heavy_check_mark:|[State Verification](#state-verification) or [Behaviour Verification](#behaviour-verification)|
|Stub|:x:|[State Verification](#state-verification)|
|Spy|:heavy_check_mark:|[Behaviour Verification](#behaviour-verification)|
|Mock|:heavy_check_mark:|[State Verification](#state-verification) or [Behaviour Verification](#behaviour-verification)|

> Dummy 為什麼可以做狀態驗證？\
> 它沒有在 check 輸出阿？\
> 事實上狀態驗證也包含了驗證參數數量這種，即使 Dummy 只有填充物件的用途，它仍然可以做驗證

> Fake Object 可以驗證狀態或行為的原因在於\
> 他是簡單版本的實作，同時因為他是實作，代表它能驗證輸出是否符合預期\
> 更重要的是實作本身可以驗證行為(i.e. 確保執行順序像是 A :arrow_right: B :arrow_right: C)

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

> 可參考 [如何寫出好的程式碼架構 \| Shawn Hsu](../../random/solid)

## Dependency Injection Framework
當元件越來越多的時候，手動注入可能是個問題\
因此現在有一些框架有試著解決這些問題，比如說 [uber/dig](https://github.com/uber-go/dig)

> 可參考 [實際上手體驗 Golang DI Framework 之 Uber Dig \| Shawn Hsu](../../random/golang-dig)

dig 的做法是將全部的元件都註冊到 container 裡面\
container 類似一個管理中樞，所有元件都會在這裡註冊\
你不需要知道元件彼此之間的相依關係，你只要知道，你需要他就好\
dig 會負責幫你把所有需要的元件都注入(依靠 reflection)

> 此過程稱為 provide

舉例來說，我有 router, controller, service, database\
具體上誰依賴誰我不知道，但你可能需要他們? 要用自己拿

本質上這些工具做的事情是解決了手動註冊管理的問題\
並不會因為你用了他，你的 code 就解耦了(事實上我看過用了 Framework 還寫出黏在一起的程式碼)

此外，框架如 dig 你會沒辦法第一時間知道誰依賴誰\
這對於剛接觸 codebase 的人來說可能會無所適從\
必須要一層一層看他怎麼定義的才能明白

相對來說，也因為 DI(Dependency Injection) 相當好實作\
手動建構依賴關係的也是大有人在，具體依照團隊需求各自決定

# Issues that I have when Writing Tests
到這裡你已經足夠了解如何撰寫測試了\
不過在一開始我寫測試的時候，錯誤的實作了一些東西\
借這個機會，一起紀錄一下

## Minimize Test Case Scope
拿 cursor based pagination 為例

> 可參考 [資料庫 - 更好的分頁機制 Cursor Based Pagination \| Shawn Hsu](../../database/database-cursor-pagination)

假設你想要測試 cursor 是否能正確的查詢到下一頁的資料\
一種寫法是

```js
it("should return data if cursor is empty", () => {
    const response = request(router).get("/").query({})
    expect(response.body).toEqual(expected)

    const response2 = request(router).get("/").query({
        cursor: response.next_cursor
    })
    expect(response2.body).toEqual(expected2)
})
```
很直覺的一種寫法，為了測試 cursor 能不能正確動作\
我做了兩次 API call, 一次是為了取得下一頁的 cursor，第二次是為了驗證他有沒有正確 paginate

這樣做是屬於 bad practice, 尤其是當 cursor 並沒有依賴於前者的 response\
**每一項的測試應該是獨立的**，這樣做的好處在於出問題的時候你可以很清楚的找到問題點(i.e. root cause)

你可能會問，cursor 不是從上一次的 API call 的 response 拿回來的結果嗎\
這樣就是有依賴關係阿，為什麼還是不推薦這樣寫

原因在於 unit test 中你的資料多半是使用 mock 之類的 [Test Double](#test-double)\
理所當然的你會知道他的回傳結果是什麼\
所以在這個 context 下，拆成兩個部份是合理的

<hr>

但假設，你測試的東西是比如說 ... enum 好了\
而該 enum 裡面包含了幾十個可以接受的數值\
那麼很明顯的，將它獨立分開放，會使得程式碼過於冗長且難以維護\
但是把它擺在一起，在出錯的時候你很難確定是哪一個 value 造成問題

多數的測試框架如 [Jest](https://jestjs.io/) 並沒有提供 expect with message 的功能\
但仍然是有解的，像是 [jest-expect-message](https://www.npmjs.com/package/jest-expect-message) 就擴充原本的功能\
讓你的測試可以這樣寫

```js
const SEARCH_TYPE = {
    USER: 'USER',
    GROUP: 'GROUP'
}

const validateType = (type) => Object.values(SEARCH_TYPE).includes(type)

it("should pass if type is valid", () => {
    const validValues = ['USER', 'GROUP']

    validValues.forEach(type => {
        expect(validateType(type), `shouldn't return error if type is ${type}`).toBeTruthy()
    })
})
```

## Don't Use Inconsistent Input to Test Implementation
測試本質上的目的是在於確保你的改動不會改壞東西\
因此，你的測試資料它必須是固定不變的\
目的是當測試出錯的時候，你能夠 **重現它**

假設你用了 random() 之類的東西當輸入，每一次跑測試的資料都不一樣\
那我怎麼知道在什麼情況下，我的程式會出錯，並且對於開發者來說它很難查明 root cause\
所以這其實是個 anti pattern

正確的作法，也相對簡單\
每一筆的 test case 資料，都應該使用 fixed data\
不要使用隨機產生的資料，去測試你的程式

## Constant or Literal in Unit Test
既然我們已經知道要使用 fixed data 當作程式的 input\
另一個問題接踵而至

我在 [Do you use constants from the implementation in your test cases?](https://stackoverflow.com/questions/3360074/do-you-use-constants-from-the-implementation-in-your-test-cases) 發現有人也遇到一樣的問題\
大意是說\
在測試的時候，你的 expected result 要使用 literal 還是實作當中的 constant

以連結內的例子來看
```c
const float PI = 3.14;
float getPi() 
{ 
   return PI;
}

// 這樣子寫
void testPiIs3point14() {
   AssertEquals(getPi(), 3.14);
}

// 還是這樣子寫
void testPiIs3Point14() {
   AssertEquals(getPi(), PI);
}
```

一種是直接將期望結果寫死，一種是用個變數\
我最先想到的問題是，如果常數改變了，我的 unit test 是不是抓不到錯誤\
抓不到錯誤那我的 test case 不就白寫了

我的擔心是正確的，但我擔心的地方不該是這個 test case 該做的\
用 constant 代表說我希望這個 function 回傳的是 `PI` 這個常數的數值\
用 literal 代表我希望這個 function 回傳的是 `3.14`\
高階一點的看法是
+ `constant`: 我希望這個 function 的 ***行為*** 是回傳 `PI`

unit test 的宗旨我們開頭有提過，是測試 function 的 `logic`\
錯誤的數值是結果，導致這個結果的原因是 **logic 不符合預期**\
以這樣的觀點下去看，數值錯誤不應該在這裡處理，我只關心我的邏輯有沒有正確\
因此我們應該 **使用 constant**

但錯誤的結果需要有人負責\
因此你該做的事情是，額外寫個 unit test 確保 PI 是 3.14

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

> 有關 integration test 的介紹可以參考 [DevOps - 整合測試 Integration Test \| Shawn Hsu](../../devops/devops-integration-test)\
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

# Example
```js
describe("pageNumber", () => {
    const validators = [middleware.pageNumber()];

    it("should pass if pageNumber is valid", async () => {
      const validValues = [1, 1e3];

      for (const value of validValues) {
        const request = createRequest({ query: { pageNumber: value } });
        await testExpressValidatorMiddleware(request, validators);
        const result = validationResult(request);

        expect(result.array()).toEqual([]);
      }
    });

    it("should return error if pageNumber is invalid", async () => {
      const invalidValues = ["abc", -100];

      for (const value of invalidValues) {
        const request = createRequest({ query: { pageNumber: value } });
        await testExpressValidatorMiddleware(request, validators);
        const result = validationResult(request);
        expect(result.array()).toEqual([
          {
            ...RequestErrorTemplate,
            value,
            msg: Errors.InvalidPageNumber,
            path: "pageNumber",
            location: "query",
          },
        ]);
      }
    });
  });
```

以上是一個簡單的單元測試的例子\
主要的目的在於測試 middleware 各個 validation function 是否正確動作\
以這個例子是測試 cursor based pagination 的 `pageNumber`\
因為這個相對單純，所以沒有任何的 mock 以及 beforeEach, afterEach\
詳細的程式碼可以參考 [ambersun1234/blog-labs/cursor-based-pagination](https://github.com/ambersun1234/blog-labs/tree/master/cursor-based-pagination)

# References
+ [软件敏捷开发 TDD 方案](https://cloud.tencent.com/developer/article/1494387)
+ [使人瘋狂的 SOLID 原則：單一職責原則 (Single Responsibility Principle)](https://medium.com/%E7%A8%8B%E5%BC%8F%E6%84%9B%E5%A5%BD%E8%80%85/%E4%BD%BF%E4%BA%BA%E7%98%8B%E7%8B%82%E7%9A%84-solid-%E5%8E%9F%E5%89%87-%E5%96%AE%E4%B8%80%E8%81%B7%E8%B2%AC%E5%8E%9F%E5%89%87-single-responsibility-principle-c2c4bd9b4e79)
+ [Testing in Go: Mocking MVC using Testify and Mockery](https://medium.com/@thegalang/testing-in-go-mocking-mvc-using-testify-and-mockery-c25344a88691)
+ [Test Doubles — Fakes, Mocks and Stubs.](https://blog.pragmatists.com/test-doubles-fakes-mocks-and-stubs-1a7491dfa3da)
+ [Unit Test 中的替身：搞不清楚的Dummy 、Stub、Spy、Mock、Fake](https://medium.com/starbugs/unit-test-%E4%B8%AD%E7%9A%84%E6%9B%BF%E8%BA%AB-%E6%90%9E%E4%B8%8D%E6%B8%85%E6%A5%9A%E7%9A%84dummy-stub-spy-mock-fake-94be192d5c46)
+ [How can I do test setup using the testing package in Go](https://stackoverflow.com/questions/23729790/how-can-i-do-test-setup-using-the-testing-package-in-go)
+ [Dependency inversion principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
+ [Unit Test 觀念學習 - 3A Pattern、名詞 (SUT、DOC)](https://ithelp.ithome.com.tw/m/articles/10299052)
+ [Unit Test 實踐守則 (五) - 如何有效使用 Test Double](https://yu-jack.github.io/2020/10/12/unit-test-best-practice-part-5/)
+ [unit test 該怎麼用? 又該如何在 express 開發上實作 unit test?](https://yu-jack.github.io/2019/12/10/unit-test-express/#test-double-%E6%B8%AC%E8%A9%A6%E6%9B%BF%E8%BA%AB)
+ [Test Double（2）：五種替身簡介](https://teddy-chen-tw.blogspot.com/2014/09/test-double2.html)
