---
title: 設計模式 101 - Decorator Pattern
date: 2023-06-15
categories: [design pattern]
tags: [decorator, python]
math: true
---

# Benchmark Time Elapsed
讓我們先從簡單的一個例子看起
```python
import grpc
import time
from proto import echo_pb2
from proto import echo_pb2_grpc

# def benchmark(stub):
#     stub.Echo(echo_pb2.EchoRequest(input="2"))

def benchmark(stub, f):
    start_time = time.perf_counter_ns()
    stub.Echo(echo_pb2.EchoRequest(input="2"))
    end_time = time.perf_counter_ns()
    time_diff = end_time - start_time

    f.write(f"{i + 1} {time_diff}\n")

if __name__ == "__main__":
    round = 100000
    with grpc.insecure_channel('localhost:6600') as channel:
        stub = echo_pb2_grpc.EchoStub(channel)

        with open("grpc-benchmark.txt", "w") as f:
            for i in range(round):
                benchmark(stub, f)
```

以我個人來說，我很常會需要對我的實做進行所謂的 benchmark\
常見的方法即為，測試目標 function 所需要花費的時間，上述我想要測試 gRPC 的平均呼叫時間\
可以看到，為了要加入測試時間的程式碼，我不得不重新修改實做本身，讓它得以 **擴展** 它原本的行為\
除了執行基本的 gRPC 呼叫，它還可以測試執行時間，並寫到特定的檔案內

某種程度上它很丑對吧\
為了新增某個功能而改變原本的實做本身屬實是不太好的行為\
這個篇章我們將一窺 [Decorator Pattern](#decorator-pattern) 可以如何解決這個問題

> 有關 gRPC 的相關介紹，可以參考 [網頁程式設計三兩事 - gRPC \| Shawn Hsu](../../website/website-grpc)\
> 詳細的實做程式碼可以參考 [ambersun1234/blog-labs/RESTful-vs.-gRPC-benchmark](https://github.com/ambersun1234/blog-labs/tree/master/RESTful-vs.-gRPC-benchmark)

# Open-Closed Principle
> Class should be open for extension, but closed for modification

這個原則出現於 [Bertrand Meyer](https://en.wikipedia.org/wiki/Bertrand_Meyer) 所撰寫的物件導向書籍

一個模組或者說物件，要怎麼樣同時保有這兩種特性？\
不願意被修改可以很好理解，如果要新增功能，我們可以藉由 inheritance(繼承) 自己實做新功能\
但是你又說歡迎擴展？ 不是不願意更改嗎？

回顧一下\
一個物件由兩個基本的要素組成，**屬性**(data) 以及 **行為**(function)\
一旦物件建立完成，我可以肯定的說，*行為* 是沒辦法輕易調整的對吧\
屬性可以調整嗎？ 答案是可以的

在 [設計模式 101 - Observer Pattern \| Shawn Hsu](../../design%20pattern/design-pattern-observer) 裡面我們就有幹過類似的事情\
我們是不是可以 ***動態的*** 新增/刪除觀察者？\
這些觀察者是 屬性(data), 但是更改的同時，我們並沒有動到任何行為(function)

# Decorator Pattern
我們可以更進一步的用 callback function 改進我們的 benchmark 程式
```python
def time_elapsed(func):
    start_time = time.perf_counter_ns()
    func()
    end_time = time.perf_counter_ns()
    time_diff = end_time - start_time

    f.write(f"{i + 1} {time_diff}\n")

def benchmark():
    stub.Echo(echo_pb2.EchoRequest(input="2"))

# caller
time_elapsed(benchmark())
```

這本質上就是 Decorator Pattern 想達成的事情\
我可以根據需要，***動態的*** 加上額外的功能，而且我可以加很多層\
且不會更改到原本的邏輯(即 [Open-Closed Principle](#open-closed-principle))

## Object Oriented Programming
在 OOP 的世界裡，我們可以用比較 OO 的方法處理 Decorator Pattern\
亦即不使用 function 包 function 的方式，而是採 class 包 class

設想我們有一個車輛訂購系統，使用者可以為他們的愛車新增選配(e.g. 行車記錄器、尾翼、避震 ... etc.)\
寫起來會長這樣
```python
from abc import ABC, abstractclassmethod

# interfaces
class CarInterface(ABC):
    @abstractclassmethod
    def cost(self) -> int: raise NotImplementedError

class EquipmentInterface(ABC):
    def __init__(self, car: CarInterface):
        self.car = car

    @abstractclassmethod
    def cost(self) -> int: raise NotImplementedError

# car
class Benx(CarInterface):
    def cost(self) -> int:
        return 100
    
# equipment
class Recorder(EquipmentInterface):
    def cost(self) -> int:
        return self.car.cost() + 12
    
class ShockAbsorber(EquipmentInterface):
    def cost(self) -> int:
        return self.car.cost() + 80
    
if __name__ == "__main__":
    car = Benx()
    car = Recorder(car)
    car = ShockAbsorber(car)

    print(car.cost())
```

上述的實做可以這樣解讀
```
整輛車的價格 = 改避震器的價格 + 其他1
其他1 = 行車記錄器的價格 + 其他2
...
依此類推
```
跟 divide and conquer 滿像的對吧？\
老實說，這個方式跟非 OOP 的作法是一樣的，只不過我們是用 class 進行操作的

<hr>

不論 OOP 與否，Decorator 的核心概念就是 ***動態的*** 新增額外功能，而不更改到原本的實做

# Benchmark Time Elapsed with Decorator Pattern
Python 有內建提供給 [Decorator Pattern](#decorator-pattern) 的 syntax sugar\
當然，decorator 還是要由我們自己設計\
於是可以改成最終完成版如下

```python
import grpc
import time
from proto import echo_pb2
from proto import echo_pb2_grpc

def time_elapsed(func):
    def measure_time():
        start_time = time.perf_counter_ns()
        func()
        end_time = time.perf_counter_ns()
        time_diff = end_time - start_time

        f.write(f"{i + 1} {time_diff}\n")

    return measure_time

@time_elapsed
def benchmark():
    stub.Echo(echo_pb2.EchoRequest(input="2"))

if __name__ == "__main__":
    round = 100000
    with grpc.insecure_channel('localhost:6600') as channel:
        stub = echo_pb2_grpc.EchoStub(channel)

        with open("grpc-benchmark.txt", "w") as f:
            for i in range(round):
                benchmark()
```

> 詳細的實做程式碼可以參考 [ambersun1234/blog-labs/RESTful-vs.-gRPC-benchmark](https://github.com/ambersun1234/blog-labs/tree/master/RESTful-vs.-gRPC-benchmark)

採用 [Decorator Pattern](#decorator-pattern) 之後，我既不會更改原本的實做，但我仍然可以擴充它，是不是很漂亮呢？

> decorator 裡面的 i 與 f 都是取自 global variable scope\
> 當僅僅讀取 global variable 的時候不需要使用 `global xxx` syntax

> i 的 variable scope 不是存在於 for-loop, 而是存在於整個 function\
> 可參考 [Do iteration variable exist after the iteration statement in python? \[duplicate\]](https://stackoverflow.com/questions/21394161/do-iteration-variable-exist-after-the-iteration-statement-in-python)

> `if __name__ == "__main__"` 的 variable scope 屬於 global\
> 可參考 [The scope of if \_\_name\_\_ == \_\_main\_\_](https://stackoverflow.com/questions/12807069/the-scope-of-if-name-main)

# References
+ 深入淺出設計模式 第二版(ISBN: 978-986-502-936-4)
+ [Open–closed principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle)