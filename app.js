const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

// 使用中间件
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// 设置数据库路径
const dbPath = path.join(__dirname, 'db', 'sqlite.db');

// 确保数据库文件夹存在
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath));
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 创建表
    db.run("CREATE TABLE IF NOT EXISTS gold_price (date TEXT, price REAL)");

    // 获取金价数据并存入数据库
    axios.get('https://query1.finance.yahoo.com/v7/finance/download/GC=F?period1=0&period2=9999999999&interval=1d&events=history')
        .then(response => {
            const data = response.data.split('\n').slice(1);
            const stmt = db.prepare("INSERT INTO gold_price VALUES (?, ?)");

            data.forEach(row => {
                const [date, price] = row.split(',');
                stmt.run(date, parseFloat(price));
            });

            stmt.finalize();
        });
});

// 路由：获取金价数据
app.get('/prices', (req, res) => {
    const { date } = req.query;
    let query = "SELECT * FROM gold_price";
    const params = [];

    if (date) {
        query += " WHERE date = ?";
        params.push(date);
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            throw err;
        }
        res.json(rows);
    });
});

module.exports = app;
