import { describe, expect, it } from "vitest";
import { checkSignupEmail } from "./email-policy";

function canon(email: string) {
  const r = checkSignupEmail(email);
  if (!r.ok) throw new Error(r.error);
  return r.canonical;
}

describe("signup email policy", () => {
  it("accepts mainstream providers", () => {
    for (const e of ["a@gmail.com", "a@outlook.com", "a@hotmail.com", "a@live.com", "a@msn.com", "a@yahoo.com", "a@yahoo.co.in", "a@proton.me", "a@protonmail.com", "a@pm.me"]) {
      expect(checkSignupEmail(e).ok).toBe(true);
    }
  });

  it("refuses disposable and unknown domains", () => {
    for (const e of ["x@mailinator.com", "x@tempmail.com", "x@10minutemail.com", "x@company.in", "x@guerrillamail.com"]) {
      expect(checkSignupEmail(e).ok).toBe(false);
    }
  });

  it("treats Gmail dots and +tags as the same account", () => {
    expect(canon("ra.vi@gmail.com")).toBe(canon("ravi@gmail.com"));
    expect(canon("ravi+sales@gmail.com")).toBe(canon("ravi@gmail.com"));
    expect(canon("r.a.v.i+x1@googlemail.com")).toBe("ravi@gmail.com");
  });

  it("treats Outlook/Live +tags and Yahoo -tags as the same account", () => {
    expect(canon("ravi+x@outlook.com")).toBe(canon("ravi@outlook.com"));
    expect(canon("ravi-x@yahoo.com")).toBe(canon("ravi@yahoo.com"));
  });

  it("treats Proton domains as one", () => {
    expect(canon("ravi+x@pm.me")).toBe("ravi@protonmail.com");
    expect(canon("ravi@proton.me")).toBe("ravi@protonmail.com");
  });

  it("ignores case", () => {
    expect(canon("Ravi@GMAIL.com")).toBe("ravi@gmail.com");
  });
});
