import { menuAPI } from "./menu/api";
import { moduleAPI } from "./module/api";
import { roleAPI } from "./role/api";
import { statusAPI } from "./status/api";
import { userAPI } from "./user/api";

export const systemAPI = {
    user: userAPI,
    role: roleAPI,
    menu: menuAPI,
    module: moduleAPI,
    status: statusAPI,
};
