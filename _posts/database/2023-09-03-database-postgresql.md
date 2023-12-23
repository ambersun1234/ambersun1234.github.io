---
title: 資料庫 - 從 MySQL 到 PostgreSQL 一些新手會遇到的問題
date: 2023-09-03
categories: [database]
tags: [database, postgresql, mysql, sql standard, sql]
math: true
---

# Preface
作為用了 MySQL 五年之久的我，原本以為同為 SQL\
在語法上的差異不會影響到太多\
實際上手之後，發現還是有點差異

因此這裡會稍微的紀錄一下，遇到的問題以及其解決方法\
當然還有新的語法

# Environment Setup
為了能夠更好的測試文中範例\
這裡需要設定好測試用資料庫

## MySQL(Mariadb)
```shell
$ docker run -d \
    -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=true \
    -e MARIADB_DATABASE=test \
    --name test-mysql mariadb
$ docker exec -it test-mysql bash
> mariadb -u root -p
> use test;
```

> mariadb version 11.0.2

### SQL Data
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id)
);
CREATE TABLE posts (
    id INT AUTO_INCREMENT,
    user_id INT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT pk_posts PRIMARY KEY (id),
    CONSTRAINT fk_users FOREIGN KEY (user_id) REFERENCES users(id)
    CONSTRAINT uk_posts UNIQUE (user_id, title, deleted_at)
);
INSERT INTO users (username, email)
VALUES ('john', 'john@example.com'),
    ('alice', 'alice@example.com'),
    ('bob', 'bob@example.com'),
    ('bob', 'bob2@example.com');
INSERT INTO posts (user_id, title, content)
VALUES (1, 'hello', 'This is the first post by john.'),
    (1, '','Another post by john.'),
    (2, 'hello', 'User2 is posting here.'),
    (3, 'hello', 'Hello from bob.'),
    (4, 'hello', 'Hello from bob.');
```

##  PostgreSQL
```shell
$ docker run -d \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=test \
    --name test-postgres postgres:15
$ docker exec -it test-postgres bash
> psql -U postgres
> \c test
```

> postgres version 15.4

### SQL Data
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL
);
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE (user_id, title, deleted_at)
);
INSERT INTO users (username, email)
VALUES ('john', 'john@example.com'),
    ('alice', 'alice@example.com'),
    ('bob', 'bob@example.com'),
    ('bob', 'bob2@example.com');
INSERT INTO posts (user_id, title, content)
VALUES (1, 'hello', 'This is the first post by john.'),
    (1, '', 'Another post by john.'),
    (2, 'hello', 'User2 is posting here.'),
    (3, 'hello', 'Hello from bob.'),
    (4, 'hello', 'Hello from bob.');
```

# Column must appear in the GROUP BY clause or be used in an aggregate function
這大概是我撞過無數次的問題，直到現在還是偶爾會寫錯

其實它寫得很清楚，別擔心我第一次看到也是霧颯颯\
看個例子比較直接

好比如說你想要計算 `同名的 user 總共發布了多少的文章`\
當然在 MySQL 你可以使用
```sql
SELECT u.email, u.username, COUNT(*) AS num_posts
FROM posts AS p LEFT JOIN users AS u ON p.user_id = u.id
GROUP BY u.username
```

在 PostgreSQL 中，上述指令會出現 
```
Error: Column "u.email" must appear in the GROUP BY clause or be used in an aggregate function
```
要了解為什麼會出現這個問題，首先來了解一下 [SQL Standard](#sql-standard)

## SQL Standard
SQL 標準的定義，你可以在這裡找到 [ISO/IEC 9075:2023](https://webstore.ansi.org/standards/iso/isoiec90752023-2502159?source=blog&_gl=1*dzkgcw*_gcl_au*MTA0ODgyODQyMy4xNjkzNjQzMzcx)

> 很可惜的一點是，它並非 open source 的，所以找資料稍微困難

不過說起來為什麼我們要看 SQL standard 呢？\
它跟 GROUP BY 又有什麼關係\
讓我們來看看 MySQL 對於自家 GROUP BY 的解釋吧

根據 [12.19.3 MySQL Handling of GROUP BY](https://dev.mysql.com/doc/refman/8.0/en/group-by-handling.html) 所述
> SQL-92 and earlier does not permit queries for which the \
> select list, HAVING condition, or ORDER BY list refer to nonaggregated columns \
> that are not named in the GROUP BY clause. 

翻成白話文就是，在 `SQL 92` 以及以前的標準
```
任何使用到的 column(不論在 SELECT, HAVING 或者是 ORDER BY) 
只要沒有使用 aggregation function 者
必須要出現在 GROUP BY 裡面
```

那 `SQL 92` 之後呢？
```
如果該 column 與 GROUP BY 的 column 有 functional dependence 的關係
就是合法的
比如說 user_id 與 username 是有 functional dependence 的關係
```

### Functional Dependence
functional dependence 是說欄位 X 可以決定唯一的欄位 Y
> **X** uniquely determines **Y**, so **Y** is functionally dependent on **X**

舉例來說，user table 中\
`user_id` 可以決定唯一的 `user_name`\
這樣就可以說 `user_name` functionally dependent on `user_id`

<hr>

在隨後的文件中，MySQL 還提到

> If [ONLY_FULL_GROUP_BY](https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_only_full_group_by) is disabled, \
> a MySQL extension to the standard SQL use of GROUP BY permits the select list, HAVING condition, or ORDER BY list \
> to refer to nonaggregated columns even if the columns are not functionally dependent on GROUP BY columns. \
> \
> This causes MySQL to accept the preceding query. \
> In this case, the server is free to choose any value from each group, \
> so unless they are the same, the values chosen are nondeterministic, which is probably not what you want

意思就是說在 [ONLY_FULL_GROUP_BY](https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_only_full_group_by) disabled 的情況下，如果 **不滿足 functional dependence**\
MySQL 會擴充 standard SQL，並視該 query 為合法的\
只不過在 return row 的時候，它會 ***隨機的選一筆*** 當作 result(即使你把它排序過也不保證)

就拿上面的例子來說，MySQL 回傳的結果為
```
+-------------------+----------+-----------+
| email             | username | num_posts |
+-------------------+----------+-----------+
| alice@example.com | alice    |         1 |
| bob@example.com   | bob      |         2 |
| john@example.com  | john     |         2 |
+-------------------+----------+-----------+
```

bob 明明有兩個人，兩種不同的 email\
可是在這裡卻只顯示出 `bob@example.com`, 而 `bob2@example.com` 卻莫名的不見了

而 MySQL 自己也提到，他的內部有針對 functional dependence 實作 detection 的機制\
因此即使你 SELECT 一些 non-aggregated 的 column，MySQL 會自動推論它是否與 GROUP BY column 為 functional dependence 的關係

但是 PostgreSQL 內部，就我目前看到的資料來說，並沒有實作此類 detection 的機制\
如同前一節看到的範例一樣，PostgreSQL 在這種狀況下會拋出 error\
所以，你必須使用 aggregate function 或者是 GROUP BY\
這樣回過頭來看這個 Error 是不是就很明確了

結論就是\
MySQL 可以有限度的幫你做推論這件事情\
但 PostgreSQL 就要求你 "明確的指定"

# Window Function
所以針對上述的 sql query 要怎麼改才可以在 PostgreSQL 跑呢\
透過簡單的 window function 可以輕易的達成

```sql
SELECT u.email, u.username, COUNT(*) OVER(PARTITION BY u.username) 
FROM posts AS p LEFT JOIN users AS u ON p.user_id = u.id 
GROUP BY u.email, u.username;
```

```
       email       | username | count 
-------------------+----------+-------
 alice@example.com | alice    |     1
 bob@example.com   | bob      |     2
 bob2@example.com  | bob      |     2
 john@example.com  | john     |     1
```

<hr>

window function 根據 PostgreSQL 官方的定義如下\
`A window function performs a calculation across a set of table rows that are somehow related to the current row`\
也就是說我將同一種類的資料擺在一起做計算\
以我們的例子來說，是把相同 username 擺在一起(`PARTITION BY u.username`)

而從上面的結果也可以得知\
兩個不同的 bob 都有正確的顯示出來，而他的結果是可以預測的(相對於 MySQL 的實作是 nondeterministic 的)\
我們更可以推測出一件事情，就是 window function 計算過得資料 **並不會合併成一列**，相反的彼此之間的前後關係仍然有所保留

## LAG() vs. LEAD()
**LAG()** 是用以計算以目前為準，`往前 N 筆的資料`\
**LEAD()** 是用以計算以目前為準，`往後 N 筆的資料`

舉例來說，你想要找出每個 user 的發文與前一筆發文\
你可以這樣寫
```sql
SELECT 
user_id, content, 
LAG(content, 1) OVER(PARTITION BY user_id ORDER BY created_at) AS previous_content 
FROM posts
```

```
 user_id |             content             |        previous_content         
---------+---------------------------------+---------------------------------
       1 | This is the first post by john. | 
       1 | Another post by john.           | This is the first post by john.
       2 | User2 is posting here.          | 
       3 | Hello from bob.                 | 
       4 | Hello from bob.                 | 
```

## ROW_NUMBER()
就跟他的名字一樣，第一列為 1, 第二列為 2 ... 以此類推\
我們可以使用 **ROW_NUMBER()** 改寫 [LAG() vs. LEAD()](#lag-vs-lead) 中的範例

```sql
WITH posts_history AS (
    SELECT *, ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY created_at) AS rn
    FROM posts
)
SELECT p1.user_id, p1.content, p2.content AS previous_content
FROM posts_history AS p1 LEFT JOIN posts_history AS p2 
ON p1.rn = p2.rn + 1 AND p1.user_id = p2.user_id
ORDER BY p1.user_id
```

將 目前所在列與他的下一列(`p1.rn = p2.rn + 1`) join 起來，由於我們的集合內部有對 `created_at` 排序過\
所以他的偏移量剛好是下一筆資料

# Explain SQL Query
Explain 可以用於查看 query 的 execution plan\
在 MySQL 中，你可以看到各個階段，對於 Index 的使用程度為何\
不過顯示出的資訊跟 PostgreSQL 裡的有一點落差

讓我們來分別看看 [LAG() vs. LEAD()](#lag-vs-lead) 與 [ROW_NUMBER()](#row_number) 範例的執行計畫

## PostgreSQL Explain SQL Query
```sql
EXPLAIN SELECT 
user_id, content, 
LAG(content, 1) OVER(PARTITION BY user_id ORDER BY created_at) AS previous_content 
FROM posts

                              QUERY PLAN                              
----------------------------------------------------------------------
 WindowAgg  (cost=74.54..95.94 rows=1070 width=76)
   ->  Sort  (cost=74.54..77.21 rows=1070 width=44)
         Sort Key: user_id, created_at
         ->  Seq Scan on posts  (cost=0.00..20.70 rows=1070 width=44)
```

在 query plan 當中，你總是會看到 `(cost=74.54..95.94 rows=1070 width=76)` 這麼一行\
它代表的意思是這樣子的
1. 估計啟動成本
2. 估計總成本
3. 估計輸出資料列數量
4. 估計資料列平均資料大小

所以第一列的估計值，就是整體 query 的估計值\
你可以看到，在 [LAG() vs. LEAD()](#lag-vs-lead) 中使用的 SQL query 他的總成本為 `95.94`\
往下看它會分別列出每一個步驟所耗費的成本，舉例來說\
第二列的 sort 是 window function 裡面我們用了排序造成的(user_id 則是預設分割的方式，所以它也有納入)

```sql
EXPLAIN WITH posts_history AS (
    SELECT *, ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY created_at) AS rn
    FROM posts
)
SELECT p1.user_id, p1.content, p2.content AS previous_content
FROM posts_history AS p1 LEFT JOIN posts_history AS p2 
ON p1.rn = p2.rn + 1 AND p1.user_id = p2.user_id
ORDER BY p1.user_id;
                                   QUERY PLAN                                    
---------------------------------------------------------------------------------
 Merge Left Join  (cost=246.42..268.11 rows=1070 width=68)
   Merge Cond: ((p1.user_id = p2.user_id) AND (p1.rn = ((p2.rn + 1))))
   CTE posts_history
     ->  WindowAgg  (cost=74.54..95.94 rows=1070 width=56)
           ->  Sort  (cost=74.54..77.21 rows=1070 width=48)
                 Sort Key: posts.user_id, posts.created_at
                 ->  Seq Scan on posts  (cost=0.00..20.70 rows=1070 width=48)
   ->  Sort  (cost=75.24..77.91 rows=1070 width=44)
         Sort Key: p1.user_id, p1.rn
         ->  CTE Scan on posts_history p1  (cost=0.00..21.40 rows=1070 width=44)
   ->  Sort  (cost=75.24..77.91 rows=1070 width=44)
         Sort Key: p2.user_id, ((p2.rn + 1))
         ->  CTE Scan on posts_history p2  (cost=0.00..21.40 rows=1070 width=44)
```

> CTE 為在 materialized view 之上的 sequential scan\
> 以這個例子來看就是 WITH posts_history as (...) 的部份

對於較為複雜的 SQL query 你可以看到\
整體的執行計畫就變得很複雜了\
而他的總成本 `268.11` 也明顯高於使用 LAG() 方法的 `95.94`

## MySQL Explain SQL Query
```sql
SELECT
p1.user_id,
p1.content AS current_content,
IFNULL(p2.content, '') AS previous_content
FROM posts p1 LEFT JOIN posts p2
ON p1.user_id = p2.user_id AND p1.id > p2.id
ORDER BY p1.user_id, p1.id;
```

> 這個 query 實際上可能會有問題，因為它不一定可以 match 到 physical order 的前一筆\
> 但我們只是要看他的執行計畫，所以可以忽略

```
+------+-------------+-------+------+------------------+----------+---------+-----------------+------+----------------+
| id   | select_type | table | type | possible_keys    | key      | key_len | ref             | rows | Extra          |
+------+-------------+-------+------+------------------+----------+---------+-----------------+------+----------------+
|    1 | SIMPLE      | p1    | ALL  | NULL             | NULL     | NULL    | NULL            | 5    | Using filesort |
|    1 | SIMPLE      | p2    | ref  | PRIMARY,fk_users | fk_users | 4       | test.p1.user_id | 1    | Using where    |
+------+-------------+-------+------+------------------+----------+---------+-----------------+------+----------------+
```

要看的就幾個而已
1. `type`
    + 這裡可以看到有 `ALL`(full table scan) 以及 `ref`(reference)
2. `key`
    + p2 表在 join 的時候有使用到 foreign key
3. `rows`
    + p2 的表只會回傳一行，代表說他是擁有 [Functional Dependence](#functional-dependence) 的特性

# Unique Constraint
這個算是最近踩到的\
我本身在測試的環境是 PostgreSQL 14\
而這個版本的 PostgreSQL 在 unique constraint 上面有一個很特別的規則

根據 [PostgreSQL E.5. Release 15 - E.5.3.1.2. Indexes](https://www.postgresql.org/docs/15/release-15.html#id-1.11.6.5.5.3.4) 裡面提到的
> Allow unique constraints and indexes to treat NULL values as not distinct (Peter Eisentraut)\
> \
> Previously NULL entries were always treated as distinct values, \
> but this can now be changed by creating constraints and indexes using UNIQUE NULLS NOT DISTINCT.

大意是說，PostgreSQL 15 以前的所有版本，都將 null data 視為 `distinct values`

很明顯這不是我們所期望的\
`null` 應該是一樣的才對？\
如果你短時間內沒辦法升級成 15 該怎麼辦？\
可以設定兩組 unique index, 亦即 `(userID, title, deletedAt)` 與 `(userID, title)`

假設你有一個需求是這樣子，我希望每個使用者發文的文章 title 都必須是 distinct 的\
理所當然的你的 constraint 是設定 `(userID, title, deletedAt)`\
然後你的 deletedAt 預設為 null(文章可以被刪除)\
你已經有一筆資料 `(12, 邁阿密旅遊記, null)`\
如果又有新的一筆，一樣是 `(12, 邁阿密旅遊記, null)`，它是可以被成功寫入的，在 15 以前

![](https://media.makeameme.org/created/why-did-you-5c3700.jpg)
> [https://makeameme.org/meme/why-did-you-5c3700](https://makeameme.org/meme/why-did-you-5c3700)

## Experiment
設定環境的步驟如同前面所述(可參考 [Environment Setup](#environment-setup))

### PostgreSQL 15
在 PostgreSQL 15 中，如果你新增一筆 `(1, 'hello')` 會得到以下結果
```shell
test=# INSERT INTO posts(user_id, title, content) VALUES (1, 'hello', '');
ERROR:  null value in column "content" of relation "posts" violates not-null constraint
DETAIL:  Failing row contains (6, 1, hello, null, 2023-10-08 16:11:34.111809, null).
test=#

test=# \d posts;
                                        Table "public.posts"
   Column   |            Type             | Collation | Nullable |              Default              
------------+-----------------------------+-----------+----------+-----------------------------------
 id         | integer                     |           | not null | nextval('posts_id_seq'::regclass)
 user_id    | integer                     |           | not null | 
 title      | text                        |           | not null | 
 content    | text                        |           | not null | 
 created_at | timestamp without time zone |           | not null | CURRENT_TIMESTAMP
 deleted_at | timestamp without time zone |           |          | 
Indexes:
    "posts_pkey" PRIMARY KEY, btree (id)
    "posts_user_id_title_deleted_at_key" UNIQUE CONSTRAINT, btree (user_id, title, deleted_at)
Foreign-key constraints:
    "posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id)
```

符合預期，確實 null 已經 **不在被視為是 distinct values**

### PostgreSQL 14
> 設定如先前的 docker command，替換掉 docker image 為 `postgres:14` 即可

那麼 PostgreSQL 14 呢\
即使有新增 constraint 它也接受寫入，正如上一節提到在 15 以前 null value 都被視為 distinct values
```shell
test=# SELECT * FROM posts;
 id | user_id | title |             content             |         created_at         | deleted_at 
----+---------+-------+---------------------------------+----------------------------+------------
  1 |       1 | hello | This is the first post by john. | 2023-10-08 16:14:29.786042 | 
  2 |       1 |       | Another post by john.           | 2023-10-08 16:14:29.786042 | 
  3 |       2 | hello | User2 is posting here.          | 2023-10-08 16:14:29.786042 | 
  4 |       3 | hello | Hello from bob.                 | 2023-10-08 16:14:29.786042 | 
  5 |       4 | hello | Hello from bob.                 | 2023-10-08 16:14:29.786042 | 
  7 |       1 | hello |                                 | 2023-10-08 16:15:40.923995 | 
(6 rows)

test=# \d posts;
                                        Table "public.posts"
   Column   |            Type             | Collation | Nullable |              Default              
------------+-----------------------------+-----------+----------+-----------------------------------
 id         | integer                     |           | not null | nextval('posts_id_seq'::regclass)
 user_id    | integer                     |           | not null | 
 title      | text                        |           | not null | 
 content    | text                        |           | not null | 
 created_at | timestamp without time zone |           | not null | CURRENT_TIMESTAMP
 deleted_at | timestamp without time zone |           |          | 
Indexes:
    "posts_pkey" PRIMARY KEY, btree (id)
    "posts_user_id_title_deleted_at_key" UNIQUE CONSTRAINT, btree (user_id, title, deleted_at)
Foreign-key constraints:
    "posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id)

test=#
```

前面還有提到一個解法，就是我再加一個 partial index
```shell
// 先把現有的 constraint 拿掉
test=# ALTER TABLE posts DROP CONSTRAINT posts_user_id_title_deleted_at_key;

// 新增兩個 partial index
test=# CREATE UNIQUE INDEX uk_id_title on posts (user_id, title) WHERE deleted_at IS NULL;
CREATE INDEX
test=# CREATE UNIQUE INDEX uk_id_title_deleted_at on posts(user_id, title, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX

// 最後會長這樣
test=# \d posts;
                                        Table "public.posts"
   Column   |            Type             | Collation | Nullable |              Default              
------------+-----------------------------+-----------+----------+-----------------------------------
 id         | integer                     |           | not null | nextval('posts_id_seq'::regclass)
 user_id    | integer                     |           | not null | 
 title      | text                        |           | not null | 
 content    | text                        |           | not null | 
 created_at | timestamp without time zone |           | not null | CURRENT_TIMESTAMP
 deleted_at | timestamp without time zone |           |          | 
Indexes:
    "posts_pkey" PRIMARY KEY, btree (id)
    "uk_id_title" UNIQUE, btree (user_id, title) WHERE deleted_at IS NULL
    "uk_id_title_deleted_at" UNIQUE, btree (user_id, title, deleted_at) WHERE deleted_at IS NOT NULL
Foreign-key constraints:
    "posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id
```

讓我們來測試看看 constraint 會不會正確動作
```shell
test=# SELECT * FROM posts;
 id | user_id | title |             content             |         created_at         | deleted_at 
----+---------+-------+---------------------------------+----------------------------+------------
  1 |       1 | hello | This is the first post by john. | 2023-10-08 16:14:29.786042 | 
  2 |       1 |       | Another post by john.           | 2023-10-08 16:14:29.786042 | 
  3 |       2 | hello | User2 is posting here.          | 2023-10-08 16:14:29.786042 | 
  4 |       3 | hello | Hello from bob.                 | 2023-10-08 16:14:29.786042 | 
  5 |       4 | hello | Hello from bob.                 | 2023-10-08 16:14:29.786042 | 
(5 rows)

test=# INSERT INTO posts(user_id, title, content) VALUES (1, 'hello', '');
ERROR:  duplicate key value violates unique constraint "uk_id_title"
DETAIL:  Key (user_id, title)=(1, hello) already exists.
```

當 `deleted_at` 為空的時候，因為 `user_id` 與 `title` 都重複到\
因此 PostgreSQL 14 正確的回復了一個錯誤，說這個組合已經存在，不能寫入

```shell
test=# INSERT into posts(user_id, title, content, deleted_at) values(1, 'hello', '', now());
INSERT 0 1
test=# select * from posts;
 id | user_id | title |             content             |         created_at         |         deleted_at         
----+---------+-------+---------------------------------+----------------------------+----------------------------
  1 |       1 | hello | This is the first post by john. | 2023-10-08 16:14:29.786042 | 
  2 |       1 |       | Another post by john.           | 2023-10-08 16:14:29.786042 | 
  3 |       2 | hello | User2 is posting here.          | 2023-10-08 16:14:29.786042 | 
  4 |       3 | hello | Hello from bob.                 | 2023-10-08 16:14:29.786042 | 
  5 |       4 | hello | Hello from bob.                 | 2023-10-08 16:14:29.786042 | 
  9 |       1 | hello |                                 | 2023-10-08 16:34:45.991099 | 2023-10-08 16:34:45.991099
(6 rows)
```
而當 `deleted_at` 有值的時候，就允許寫入了

## Prisma
另外值得注意的是，如果你使用 [prisma](https://www.prisma.io/)\
prisma 目前不支援 conditional index 的寫法(測試環境是 `5.3` 版)\
也就是 `CREATE UNIQUE INDEX ... WHERE ...` 的寫法是沒有用的

你說手動更改 migration script 有效果嗎？\
不但沒有用而且 prisma 會自動建立新的 migration，這是已知的行為\
可參考 
+ [Partial unique indexes are being recreated on every migration with prisma migrate #13417](https://github.com/prisma/prisma/issues/13417#issuecomment-1732034518)
+ [Prisma tries to re-create indexes in migration if they were previously created with "WHERE" #14651](https://github.com/prisma/prisma/issues/14651)

解決的辦法我目前想到的就是\
手動執行 custom sql script 而已
```shell
$ npx prisma db execute --file ./custom.sql -- schema prisma/schema.prisma
```

這個可能要等 prisma 官方之後的修改

# References
+ [How to Calculate Cumulative Sum-Running Total in PostgreSQL - PopSQL](https://popsql.com/learn-sql/postgresql/how-to-calculate-cumulative-sum-running-total-in-postgresql)
+ [3.5. Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)
+ [9.22. Window Functions](https://www.postgresql.org/docs/current/functions-window.html)
+ [Group by clause in mySQL and postgreSQL, why the error in postgreSQL?](https://stackoverflow.com/questions/33629168/group-by-clause-in-mysql-and-postgresql-why-the-error-in-postgresql)
+ [The SQL Standard – ISO/IEC 9075:2023 (ANSI X3.135)](https://blog.ansi.org/sql-standard-iso-iec-9075-2023-ansi-x3-135/)
+ [ANSI/ISO/IEC International Standard (IS) Database Language SQL — Part 2: Foundation (SQL/Foundation) «Part 2»](https://web.cecs.pdx.edu/~len/sql1999.pdf)
+ [What is a CTE scan, and what are its implications for performance?](https://stackoverflow.com/questions/26852535/what-is-a-cte-scan-and-what-are-its-implications-for-performance)
+ [14.1. 善用 EXPLAIN](https://docs.postgresql.tw/the-sql-language/performance-tips/using-explain#14.1.1.-explain-ji-ben-gai-nian)
+ [Day.23 分析語法效能必備 - MYSQL語法優化 (Explain)](https://ithelp.ithome.com.tw/articles/10275783)
+ [Create unique constraint with null columns](https://stackoverflow.com/questions/8289100/create-unique-constraint-with-null-columns)
