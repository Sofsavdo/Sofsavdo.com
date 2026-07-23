import { createWithUniqueCode, generatePromoCode, generateReferralCode, randomSuffix, toCodePart } from "./code-generator";

describe("randomSuffix", () => {
  it("returns the requested length, drawn from an unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const suffix = randomSuffix(4);
      expect(suffix).toHaveLength(4);
      expect(suffix).toMatch(/^[A-HJ-NP-Z2-9]+$/); // no 0/O/1/I/L
    }
  });

  it("is not derived from Math.random — 200 draws of length 6 are effectively never all identical", () => {
    const draws = new Set(Array.from({ length: 200 }, () => randomSuffix(6)));
    // With 32^6 possibilities, 200 draws colliding down to a handful of unique values would
    // indicate a broken/non-random generator, not bad luck.
    expect(draws.size).toBeGreaterThan(190);
  });
});

describe("toCodePart", () => {
  it("uppercases and strips non-alphanumeric characters", () => {
    expect(toCodePart("Malika's Shop!", 20)).toBe("MALIKASSHOP");
  });

  it("strips diacritics instead of dropping the whole word", () => {
    expect(toCodePart("G'ofurov")).toBe("GOFUROV");
  });

  it("truncates to maxLen", () => {
    expect(toCodePart("SuperLongCampaignName", 6)).toBe("SUPERL");
  });

  it("falls back to X for input with no alphanumeric characters at all", () => {
    expect(toCodePart("!!!")).toBe("X");
  });
});

describe("generatePromoCode / generateReferralCode", () => {
  it("produces PART-PART-SUFFIX shaped, human-readable codes", () => {
    const code = generatePromoCode("Malika Yusupova", "Glow Serum");
    expect(code).toMatch(/^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]{4}$/);
    expect(code.startsWith("MALIKAYU-GLOWSERU-")).toBe(true);
  });

  it("is not deterministic — two calls for the same creator/campaign differ", () => {
    const a = generatePromoCode("Malika Yusupova", "Glow Serum");
    const b = generatePromoCode("Malika Yusupova", "Glow Serum");
    expect(a).not.toBe(b);
  });

  it("generateReferralCode follows the same shape", () => {
    const code = generateReferralCode("Aziz Karimov", "Launch Campaign");
    expect(code).toMatch(/^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]{4}$/);
  });
});

describe("createWithUniqueCode", () => {
  function p2002() {
    return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  }

  it("succeeds on the first attempt when there is no collision", async () => {
    const tryCreate = jest.fn().mockResolvedValue({ id: "row1" });
    const result = await createWithUniqueCode(() => "CODE-1", tryCreate);
    expect(result).toEqual({ id: "row1" });
    expect(tryCreate).toHaveBeenCalledTimes(1);
  });

  it("retries with a freshly generated code on a unique-constraint collision, then succeeds", async () => {
    const tryCreate = jest.fn().mockRejectedValueOnce(p2002()).mockRejectedValueOnce(p2002()).mockResolvedValueOnce({ id: "row2" });
    let n = 0;
    const generate = () => `CODE-${++n}`;
    const result = await createWithUniqueCode(generate, tryCreate, 5);
    expect(result).toEqual({ id: "row2" });
    expect(tryCreate).toHaveBeenCalledTimes(3);
    expect(tryCreate).toHaveBeenNthCalledWith(1, "CODE-1");
    expect(tryCreate).toHaveBeenNthCalledWith(2, "CODE-2");
    expect(tryCreate).toHaveBeenNthCalledWith(3, "CODE-3");
  });

  it("gives up and rethrows after maxAttempts consecutive collisions", async () => {
    const tryCreate = jest.fn().mockRejectedValue(p2002());
    await expect(createWithUniqueCode(() => "CODE", tryCreate, 3)).rejects.toMatchObject({ code: "P2002" });
    expect(tryCreate).toHaveBeenCalledTimes(3);
  });

  it("does not swallow or retry on a non-collision error", async () => {
    const boom = new Error("connection lost");
    const tryCreate = jest.fn().mockRejectedValue(boom);
    await expect(createWithUniqueCode(() => "CODE", tryCreate, 5)).rejects.toBe(boom);
    expect(tryCreate).toHaveBeenCalledTimes(1);
  });
});
