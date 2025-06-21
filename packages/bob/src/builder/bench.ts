import { bench } from "@ark/attest";
import { type } from "arktype";
import { configBuilderBuilder } from ".";

const stringType = type("string");
const stringDateParseType = type("string.date.parse");
const numberType = type("number");
const booleanType = type("boolean");
const objectType = type("object");
const nullType = type("null");
const undefinedType = type("undefined");

bench("builderBuilder", () => {
  const _ = configBuilderBuilder()
    .entry("test1", stringType)
    .entry("test2", numberType)
    .entry("test3", booleanType)
    .entry("test4", objectType)
    .entry("test5", nullType)
    .entry("test6", undefinedType)
    .build();
}).types([34917, "instantiations"]);

bench("builder", () => {
  const builder = configBuilderBuilder()
    .entry("test1", stringType)
    .entry("test2", numberType)
    .entry("test3", booleanType)
    .entry("test4", objectType)
    .entry("test5", nullType)
    .entry("test6?", undefinedType)
    .build();

  const _ = builder
    .set("test1", "test")
    .set("test2", 1)
    .set("test3", true)
    .set("test4", {})
    .set("test5", null)
    .values();
}).types([58440, "instantiations"]);

bench("type", () => {
  const builder = configBuilderBuilder()
    .entry("test1", stringDateParseType)
    .entry("test2", numberType)
    .entry("test3", booleanType)
    .entry("test4", objectType)
    .entry("test5?", nullType)
    .entry("test6?", undefinedType)
    .build();

  type _In = typeof builder.inferIn;
  type _Out = typeof builder.inferOut;
}).types([65776, "instantiations"]);
