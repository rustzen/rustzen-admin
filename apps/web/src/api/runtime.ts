import { createElement } from "react";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";

type MessageContent = string | Error;

const formatMessage = (message: MessageContent) => {
    return message instanceof Error ? message.message : message;
};

export const appMessage = {
    success: (message: MessageContent) => toast.success(formatMessage(message)),
    error: (message: MessageContent) => toast.error(formatMessage(message)),
    info: (message: MessageContent) => toast.info(formatMessage(message)),
    warning: (message: MessageContent) => toast.warning(formatMessage(message)),
    loading: (message: MessageContent) => toast.loading(formatMessage(message)),
};

export const MessageContent = () =>
    createElement(Toaster, { richColors: true, position: "top-right" });
