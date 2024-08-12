---
title: DevOps - 整合測試 Integration Test
date: 2023-10-25
description: 整合測試相較於單元測試，測試的範圍更大，跨越了 function 之間的整合。本文將會介紹整合測試的範圍以及如何利用 Dependency Injection、Docker Container 的使用，打造一個完整的整合測試環境
categories: [devops]
tags: [integration test, mock, e2e test, docker, isolation, dependency injection]
math: true
---

# Introduction to Integration Test
光是擁有 unit test，其實是不夠的\
因為 unit test 測試的範圍只有 function 本身\
跨 function 之間的整合，是沒有涵蓋到的

> 有關 unit test 的部份，可以參考 [DevOps - 單元測試 Unit Test \| Shawn Hsu](../../devops/devops-unit-test)

integration test 在這方面可以很好的 solution\
顧名思義，整合測試即為 **整合不同的 component**，一起進行測試

> integration test 並沒有一定要跟資料庫一起測試\
> 多 function 之間的整合也可以用 integration test\
> 只不過我們時常在 integration test 裡面測試資料庫

# Integration Test Scope
那麼究竟有哪些值得測試的呢？\
所有的狀況都要測試嗎？

以往在寫 unit test 的時候，為了要包含所有的測試條件\
我們會將 test case 盡可能的寫完整，寫的很詳盡\
但是在 integration test 這裡我們不推薦這樣做\
不在 integration test 做不代表我們不重視那些測試條件\
我舉個例子好了

你有一個 API `POST /group/{groupId}/members`\
作用是新增 member 到特定的 group 裡面\
他的架構是這樣子的
1. input validation middleware 會先檢查輸入是否合法，e.g. `groupId` 必須要是數字
2. permission middleware 會先檢查使用者是否為 group 的一員，並確認他的權限能否有新增操作的權限
3. service layer 會準備所需的寫入格式
4. database layer 則負責執行寫入的操作

integration test 會需要做到 input validation 嗎？\
這些是不是可以在 unit test 寫一個獨立的 validation test 呢？

因為 integration test 相比 unit test 來說是 heavy 了許多\
因此我們會希望測試的內容著重在 **component 之間的整合**\
比如說 `permission middleware + service` 有沒有正常運作, `service + database` 有沒有正常寫入

# Dependency Injection
我們在 [DevOps - 單元測試 Unit Test \| Shawn Hsu](../../devops/devops-unit-test) 有提到\
依賴於實作與依賴於界面的優缺點\
在實作整合測試的時候，這些 pros and cons 會更大程度的影響你的測試撰寫

## Parallel vs. Sequential Execution of Integration Test
講一個例子\
前陣子我發現公司的專案在執行 integration test 的時候會有問題\
看到最後發現是 transaction 的問題\
過程大概是這樣子的

Jest 本身在執行測試的時候，為了節省執行時間提昇效率\
它會使用本機所有的 core\
根據 [Jest 29.7 --maxWorkers](https://jestjs.io/docs/cli#--maxworkersnumstring) 所述
> Alias: -w. Specifies the maximum number of workers the worker-pool will spawn for running tests. \
> In single run mode, this defaults to the number of the cores available on your machine minus one for the main thread.

而正是因為這個原因，導致我們的測試出了問題\
原因是我們並沒有做好 transaction 的管理，加上多個 test 同步執行\
不同測試讀到其他人的結果，進而導致測試失敗\
我們最後只能犧牲多核的好處，強制讓其用 serializable 的模式下去跑\
現在我們的測試執行時間長達一分鐘\
而相對的解決辦法就是使用 Dependency Injection\
每一次 new 我們的 service 的時候，都給它一個新的 transaction connection\
如此一來就可以解決上述的問題

## Dependency Injection in JavaScript?
寫過一段時間的 JS 的你可能會發現\
多數的 code 都是採用 functional programming 的方式，很少會使用 Class\
沒有 Class 要怎麼做 Dependency Injection, 怎麼寫測試呢？

這時候就必須要用到 Test Double 裡面的 Fake Object 了\
Fake Object 可以提供較為簡單版本的實作\
假設你需要替換掉資料庫的界面實作，你可以透過 Fake Object 來做測試\
如此一來你不需要大改你原本的實作，只需要換成 Fake Object 就可以了

> 有關 Test Double 的介紹可以參考 [DevOps - 單元測試 Unit Test \| Shawn Hsu](../../devops/devops-unit-test/#test-double)

# Docker Container
要測試與資料庫的整合，勢必要起一個 local database\
我們的老朋友 Docker 就可以派上用場了

基本上使用說實在的也沒什麼特別的\
僅須起個 database 放著，測試的時候呼叫對應的 ip, port 即可\
就像下面這樣

```shell
$ docker run -d --name test \
    -p 6630:3306 \
    -v rest-mysql:/var/lib/mysql \
    -e MYSQL_DATABASE=db \
    -e MYSQL_USER=root \
    -e MYSQL_ROOT_PASSWORD=root \
		mariadb
```

## One Container per Test?
跑整合測試理論上來說，每個測試案例需要有獨立的 container\
但是這麼做會導致整體的 overhead 變得相對的大\
因為每一個測試都需要重新建立一個 container

具體的取捨主要看團隊的共識\
基本上因為 db 的讀寫(只要是 RDBMS) 都可以做 transaction rollback\
所以不一定需要每個測試都有獨立的 container

## dockertest
啟動 docker container 不一定只能手動建立執行\
目前也有如 [dockertest](https://github.com/ory/dockertest) 這種第三方套件的存在\
透過他你可以在程式碼內部用程式的方式啟動 docker container\
取代了手動建立維護的需求

每次使用獨立的 container 我還有遇到一個問題是 port 佔用的問題\
舉例來說，PostgreSQL 的 port 是 5432\
每一次建立的時候都會佔用同一個 port

dockertest 在這方面有提供一個解決方案\
他會自動幫你找到一個空閒的 port\
比方說 PostgreSQL 預設 5432, 他可能 map 到 33203\
利用內建的 `GetPort` function 取得該動態 port(也就是說你不需要煩惱真實的 port 是多少)\
缺點是在寫測試的時候你需要提供一個 function 設定 env 讓 application 知道\
因為像我們資料庫的連線資訊那些是透過環境變數設定的

基本上寫好，操作起來就跟手動建立一樣\
只是 container 是透過 testing code 自動維護的\
而且誠如前面所說，你不用管資料污染的問題

當然最大的缺點是，你的測試會變得很慢\
以我的例子來說，我們手上的測試大概只有 10 幾隻\
但是測試起來已經明顯地變慢了，最近的測試時間是 8 分鐘\
以往大概 5, 6 分鐘左右就可以結束

# Example
架構上跟 unit test 一樣\
我們都是寫一個 `describe` block 然後裡面放上我們要測試的東西\
就像這樣
```js
describe("test getUsersSlow", () => {
  let conn: PrismaClient;

  beforeEach(async () => {
    jest.resetAllMocks();
    conn = new PrismaClient();
    jest.spyOn(database, "newConnection").mockReturnValue(conn);
  });

  afterEach(async () => {
    await conn.$disconnect();
  });

  it("should get 2 users from page 1", async () => {
    const result = await userService.getUsersSlow(1, 2);
    const expectedResult = [
      {
        id: 1,
        username: "fZAxGMLFJU",
        created_at: new Date("2024-04-26T03:39:52.000Z"),
        updated_at: new Date("2023-10-23T09:58:36.034Z"),
      },
      {
        id: 2,
        username: "LnJhEZFRlu",
        created_at: new Date("2025-06-07T01:21:27.000Z"),
        updated_at: new Date("2023-10-23T09:58:36.034Z"),
      },
    ];

    expect(result).toEqual(expectedResult);
  });
});
```

原本的實作是這樣的
```js
export default {
  getUsersSlow: async (
    pageNumber: number,
    pageLimit: number
  ): Promise<UserResponse[]> => {
    let result: UserResponse[] = [];

    try {
      const connection = newConnection();
      result = await userDB.findUsersSlow(connection, pageNumber, pageLimit);
      logger.info("Successfully get users");
    } catch (error) {
      logger.error("Encounter error, abort", {
        error: error,
      });
      throw new Error(Errors.InternalServerError);
    }

    return result;
  }
}
```

注意到一件事情\
因為我們在這裡有跟 database 交互\
為了讓每個測試有獨立的 connection，在 `beforeEach` 的時候手動建立一個 connection\
並且使用 jest 的 spyOn 功能，將 `database.newConnection` 設置為 `conn`\
如此一來在測試的時候，就會換成我們的實作了\
然後每次執行的時候記得要將之前的 mock 重置 :arrow_right: `jest.resetAllMocks()`

> 呼應到上述 [Dependency Injection in JavaScript?](#dependency-injection-in-javascript) 說到的\
> 不一定需要使用 Dependency Injection 才能反轉依賴

至於測試最後 `afterEach` 為什麼要手動 disconnect?\
原因是我想要讓每個測試都有獨立的 connection

## Jest Error
```
A worker process has failed to exit gracefully and has been force exited. 
This is likely caused by tests leaking due to improper teardown. 
Try running with --detectOpenHandles to find leaks. 
Active timers can also cause this, ensure that .unref() was called on them.
```

在寫 mock 的時候要注意到你的 async/await 有沒有寫好\
或者是說他有沒有正確的 mock 上去\
如果沒有寫好要在檢查一遍你的 mock

<hr>

以上的程式碼你都可以在 [ambersun1234/blog-labs/cursor-based-pagination](https://github.com/ambersun1234/blog-labs/tree/master/cursor-based-pagination) 當中找到

# Difference with E2E Testing
我一開始看到 E2E test 的時候還以為他是跟 integration test 一樣的東西\
這個字詞比較常在 frontend 的領域看到，不過他的概念在 backend 也同樣適用

E2E 的全名是 End 2 End，也就是端到端\
這裡的端指的是 **使用者端** 與 **服務端**\
因此 E2E 要測試的範圍，是從使用者的角度來使用我們的服務\
換句話說，是從 API endpoint 進來到 response 的過程

# Issues that I have when Writing Tests
有了上次寫單元測試的經驗之後，寫起測試確實是比較順利\
但我還是遺漏了一些重要的事情

> 可以回顧一下 [DevOps - 單元測試 Unit Test \| Shawn Hsu](../devops-unit-test/#issues-that-i-have-when-writing-tests)

## Time is Unreliable
假設你想要測試某個 test case 有沒有在規定的時間內跑完\
第一直覺當然是直接算 time diff\
得出結果

但是時間本身是一個很不精準的東西\
即使跑測試的時候，每個 test 都會獨立執行不會互相影響\
時間仍然是擁有許多變因的\
舉例來說，context switch\
如果測試要求的精準度很高，那它更不可能成為一個良好的評斷依據

## Don't Setup Test with Your Implementation
測試當然是一次測試一個 functionality\
不過有時候你會需要做一些 setup test 之類的動作\
比方說你想要測試 `刪除 user account` 的功能\
那你一定會先建立 user account 然後再測試刪除的部份

問題在於那個 "先建立 user account" 的部份\
要注意的是，你 ***不能用 API*** 建立，也 ***不能用 service***\
正確的作法應該是直接透過 ORM 或是 Raw SQL 直接建立

Integration test 主要在測試 "單個" service 在 component 之間的整合\
考慮以下簡單版的實作

```js
await this.userService.createUser(userData)
await this.userService.deleteUser(userID)
```

這樣做，是錯的 :x:\
過程中你實際使用了多個 function\
你怎麼能保證 `createUser` 是正確的？\
即使 `createUser` 有獨立的 test case 保護，在這個 case 主要是要測試 `deleteUser`\
一個測試的 scope 應該僅限於它自己要測試的東西本身

> 至於 E2E\
> End to End 測試在於測試整個流程有沒有問題\
> 對於 end user 來說它就是一個 **黑盒子**\
> 你無法使用任何裡面的物件(i.e. services)

但是你可能會問，使用 ORM 不就違反了我們說的嗎？\
我們的目的是，測試 "我們寫的軟體" 的流程、實作有沒有問題\
如果 ORM 會錯，那其實責任不在我們身上，加上他是比較靠近底層的實作\
所以透過它幫忙 setup test 其實是沒問題的

以我的例子來說，我就 偷懶嘛\
都是使用 call api 的方式\
這樣變成是一個 test case 裡面你會測試到多種不同的功能\
而萬一其中一個壞掉，你有可能會發現不了\
更重要的是，他是屬於 bad practice

# Comparison of Testing Methodology

||Unit Test|Integration Test|E2E Test|
|:--|:--:|:--:|:--:|
|Scope|Function|Component|Whole Flow|
|Test Data|Mock|Simulate Data|Real Data|
|Speed|Fast|Slower than Unit Test|Slowest|
|Execution Environment|Local|Local or Staging|Production|

# References
