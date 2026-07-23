import { deployAPI } from "./deploy/api";
import { logAPI } from "./log/api";
import { taskAPI } from "./task/api";

export const manageAPI = {
    log: logAPI,
    task: taskAPI,
    deploy: deployAPI,
};
