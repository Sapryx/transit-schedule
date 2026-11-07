import { describe, expect, it } from "vitest";
import { transliterate } from "./transliterate.ts";

describe("transliterate", () => {
  it.each([
    ["Улица Чонгарской Дивизии", "Ulitsa Chongarskoy Divizii"],
    ["Предприятие «Салео-Гомель»", "Predpriyatie «Saleo-Gomel»"],
    ["Щорса, 15", "Shchorsa, 15"],
    ["Ёлки", "Yolki"],
    ["Объезд", "Obezd"],
  ])("writes %s in Latin as %s", (russian, latin) => {
    expect(transliterate(russian)).toBe(latin);
  });
});
