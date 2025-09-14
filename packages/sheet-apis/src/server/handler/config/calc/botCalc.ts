import { defineHandlerConfigBuilder } from "typhoon-server/config";
import * as v from "valibot";

export const botCalcHandlerConfig = defineHandlerConfigBuilder()
  .name("botCalc")
  .type("subscription")
  .request({
    validator: v.object({
      config: v.object({
        healNeeded: v.number(),
        considerEnc: v.boolean(),
      }),
      players: v.pipe(
        v.array(
          v.array(
            v.object({
              type: v.string(),
              tagStr: v.string(),
              player: v.string(),
              team: v.string(),
              lead: v.number(),
              backline: v.number(),
              bp: v.union([v.number(), v.literal("")]),
              percent: v.number(),
            }),
          ),
        ),
        v.length(5),
      ),
    }),
    validate: true,
  })
  .response({
    validator: v.array(
      v.object({
        averageBp: v.number(),
        averagePercent: v.number(),
        room: v.array(
          v.object({
            type: v.string(),
            team: v.string(),
            bp: v.number(),
            percent: v.number(),
            tags: v.array(v.string()),
          }),
        ),
      }),
    ),
  })
  .build();
