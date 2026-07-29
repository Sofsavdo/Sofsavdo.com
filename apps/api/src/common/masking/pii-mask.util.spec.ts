import { maskCustomerContact, maskCustomerName, maskPhone } from "./pii-mask.util";

describe("maskCustomerName", () => {
  it("abbreviates the first name and keeps the surname", () => {
    expect(maskCustomerName("Aziz Karimov")).toBe("A. Karimov");
  });

  it("keeps a multi-word surname intact", () => {
    expect(maskCustomerName("Dilnoza Rashidova Qizi")).toBe("D. Rashidova Qizi");
  });

  it("passes a single-word name through unchanged (nothing to abbreviate)", () => {
    expect(maskCustomerName("Malika")).toBe("Malika");
  });
});

describe("maskPhone", () => {
  it("masks a standard 12-digit UZ number into country/operator/last-2 groups", () => {
    expect(maskPhone("+998901234512")).toBe("+998 90 *** ** 12");
  });

  it("handles a number without a leading +", () => {
    expect(maskPhone("998901234512")).toBe("+998 90 *** ** 12");
  });

  it("falls back to a generic tail-preserving mask for a non-12-digit number", () => {
    expect(maskPhone("12345")).toBe("*2345");
  });
});

describe("maskCustomerContact", () => {
  it("combines the masked name and phone", () => {
    expect(maskCustomerContact("Aziz Karimov", "+998901234512")).toBe("A. Karimov, +998 90 *** ** 12");
  });
});
