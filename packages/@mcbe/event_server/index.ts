import "@mcbe/system_server";
import { createBroadcast, createListener, sharedEvents, BroadcastMapped, ListenerMapped } from "@mcbe/event";
import Event from "krevent";
import { ReceiveFromMap, SendToMap } from "./typemap";

export interface Events
{
    initialize: Event<()=>void>;
    shutdown: Event<()=>void>;
    update: Event<()=>void>;
    broadcast: BroadcastMapped<SendToMap>;
    listen: ListenerMapped<ReceiveFromMap>;
}

const events:Events = {
    initialize:sharedEvents.initialize,
    shutdown:sharedEvents.shutdown,
    update:sharedEvents.update,
    broadcast:createBroadcast(SendToMap),
    listen:createListener(ReceiveFromMap),
};
Object.freeze(events);

export default events;
