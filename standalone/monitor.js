const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
let timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
const DOWN = 0;
const UP = 1;
const PENDING = 2;
const { R } = require("redbean-node");
const { BeanModel } = require("redbean-node/dist/bean-model");

/**
 * status:
 *      0 = DOWN
 *      1 = UP
 *      2 = PENDING
 */
class Monitor extends BeanModel {
    /**
     * Return a object that ready to parse to JSON for public
     * Only show necessary data to public
     */
    async toPublicJSON() {
        return {
            id: this.id,
            name: this.name,
        };
    }

    /**
     * Return a object that ready to parse to JSON
     */
    async toJSON() {
        let notificationIDList = {};

        let list = await R.find("monitor_notification", " monitor_id = ? ", [
            this.id,
        ]);

        for (let bean of list) {
            notificationIDList[bean.notification_id] = true;
        }

        const tags = await R.getAll(
            "SELECT mt.*, tag.name, tag.color FROM monitor_tag mt JOIN tag ON mt.tag_id = tag.id WHERE mt.monitor_id = ?",
            [this.id]
        );

        return {
            id: this.id,
            name: this.name,
            url: this.url,
            method: this.method,
            body: this.body,
            headers: this.headers,
            basic_auth_user: this.basic_auth_user,
            basic_auth_pass: this.basic_auth_pass,
            hostname: this.hostname,
            port: this.port,
            maxretries: this.maxretries,
            weight: this.weight,
            active: this.active,
            type: this.type,
            interval: this.interval,
            retryInterval: this.retryInterval,
            keyword: this.keyword,
            ignoreTls: this.getIgnoreTls(),
            upsideDown: this.isUpsideDown(),
            maxredirects: this.maxredirects,
            accepted_statuscodes: this.getAcceptedStatuscodes(),
            dns_resolve_type: this.dns_resolve_type,
            dns_resolve_server: this.dns_resolve_server,
            dns_last_result: this.dns_last_result,
            pushToken: this.pushToken,
            notificationIDList,
            tags: tags,
        };
    }

    /**
     * Encode user and password to Base64 encoding
     * for HTTP "basic" auth, as per RFC-7617
     * @returns {string}
     */
    encodeBase64(user, pass) {
        return Buffer.from(user + ":" + pass).toString("base64");
    }

    /**
     * Parse to boolean
     * @returns {boolean}
     */
    getIgnoreTls() {
        return Boolean(this.ignoreTls);
    }

    /**
     * Parse to boolean
     * @returns {boolean}
     */
    isUpsideDown() {
        return Boolean(this.upsideDown);
    }

    getAcceptedStatuscodes() {
        return JSON.parse(this.accepted_statuscodes_json);
    }

    /**
     * Helper Method:
     * returns URL object for further usage
     * returns null if url is invalid
     * @returns {null|URL}
     */
    getUrl() {
        try {
            return new URL(this.url);
        } catch (_) {
            return null;
        }
    }

    static isImportantBeat(isFirstBeat, previousBeatStatus, currentBeatStatus) {
        // * ? -> ANY STATUS = important [isFirstBeat]
        // UP -> PENDING = not important
        // * UP -> DOWN = important
        // UP -> UP = not important
        // PENDING -> PENDING = not important
        // * PENDING -> DOWN = important
        // PENDING -> UP = not important
        // DOWN -> PENDING = this case not exists
        // DOWN -> DOWN = not important
        // * DOWN -> UP = important
        let isImportant =
            isFirstBeat ||
            (previousBeatStatus === UP && currentBeatStatus === DOWN) ||
            (previousBeatStatus === DOWN && currentBeatStatus === UP) ||
            (previousBeatStatus === PENDING && currentBeatStatus === DOWN);
        return isImportant;
    }

    static async getPreviousHeartbeat(monitorID) {
        return await R.getRow(
            `
            SELECT status, time FROM heartbeat
            WHERE id = (select MAX(id) from heartbeat where monitor_id = ?)
        `,
            [monitorID]
        );
    }
}

module.exports = Monitor;
