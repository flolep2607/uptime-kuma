const express = require("express");
const dayjs = require("dayjs");
const Monitor = require("./model/monitor");
const { R } = require("redbean-node");
const Database = require("./database");
const app = express();
app.listen(3003, () => console.log("open"));
const UP = 1;
const DOWN = 0;

const args = require("args-parser")(process.argv);

Database.init(args);
Database.connect(false).then(() => {
    app.get("/api/push/:pushToken", async (request, response) => {
        try {
            let pushToken = request.params.pushToken;
            let msg = request.query.msg || "OK";
            let ping = request.query.ping || null;

            let monitor = await R.findOne(
                "monitor",
                " push_token = ? AND active = 1 ",
                [pushToken]
            );

            if (!monitor) {
                throw new Error("Monitor not found or not active.");
            }

            const previousHeartbeat = await Monitor.getPreviousHeartbeat(
                monitor.id
            );

            let status = UP;
            if (request.query.status == "down") {
                status = DOWN;
            }
            let isFirstBeat = true;
            let previousStatus = status;
            let duration = 0;

            let bean = R.dispense("heartbeat");
            bean.time = R.isoDateTime(dayjs.utc());

            if (previousHeartbeat) {
                isFirstBeat = false;
                previousStatus = previousHeartbeat.status;
                duration = dayjs(bean.time).diff(
                    dayjs(previousHeartbeat.time),
                    "second"
                );
            }

            bean.important = Monitor.isImportantBeat(
                isFirstBeat,
                previousStatus,
                status
            );
            bean.monitor_id = monitor.id;
            bean.status = status;
            bean.msg = msg;
            bean.ping = ping;
            bean.duration = duration;

            await R.store(bean);

            response.json({
                ok: true,
            });
        } catch (e) {
            response.json({
                ok: false,
                msg: e.message,
            });
        }
    });
});
