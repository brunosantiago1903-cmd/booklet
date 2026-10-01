import { describe, expect, it } from "vitest";
import { decodeOfx, parseOfx, parseOfxAmount } from "./ofx";

const SGML_BANK = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20260930120000[-3:BRT]<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>0341<ACCTID>12345<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260901
<DTEND>20260930
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260905120000[-3:BRT]
<TRNAMT>-123.45
<FITID>A1
<MEMO>COMPRA CARTAO PADARIA SAO JOAO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260906
<TRNAMT>5000,00
<FITID>A2
<NAME>EMPRESA X
<MEMO>SALARIO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260907
<TRNAMT>-10.00
<MEMO>TARIFA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260907
<TRNAMT>-10.00
<MEMO>TARIFA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260908
<TRNAMT>-2.50
<FITID>A1
<MEMO>OUTRA COISA COM FITID REPETIDO
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1000.00<DTASOF>20260930</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const XML_CARD = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX>
  <CREDITCARDMSGSRSV1>
    <CCSTMTTRNRS>
      <CCSTMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260910000000[-3:BRT]</DTPOSTED>
            <TRNAMT>-89.90</TRNAMT>
            <FITID>c-1</FITID>
            <MEMO>Farmácia &amp; Drogaria</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20260912</DTPOSTED>
            <TRNAMT>1500.00</TRNAMT>
            <FITID>c-2</FITID>
            <MEMO>Pagamento recebido</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </CCSTMTRS>
    </CCSTMTTRNRS>
  </CREDITCARDMSGSRSV1>
</OFX>`;

describe("parseOfxAmount", () => {
  it.each([
    ["-123.45", -12345],
    ["5000,00", 500000],
    ["1.234,56", 123456],
    ["-1,234.56", -123456],
    ["+10", 1000],
  ])("lê %s", (raw, cents) => {
    expect(parseOfxAmount(raw)).toBe(cents);
  });

  it("rejeita texto", () => {
    expect(parseOfxAmount("abc")).toBeNull();
  });
});

describe("parseOfx", () => {
  it("lê extrato de conta em SGML", () => {
    const statement = parseOfx(SGML_BANK);
    expect(statement.accountType).toBe("checking");
    expect(statement.currency).toBe("BRL");
    expect(statement.transactions).toHaveLength(5);
    expect(statement.transactions[0]).toEqual({
      externalId: "ofx:A1",
      date: "2026-09-05",
      amountCents: -12345,
      description: "COMPRA CARTAO PADARIA SAO JOAO",
    });
    expect(statement.transactions[1]).toMatchObject({
      externalId: "ofx:A2",
      amountCents: 500000,
      description: "EMPRESA X SALARIO",
    });
  });

  it("gera ids estáveis e únicos sem FITID ou com FITID repetido", () => {
    const ids = parseOfx(SGML_BANK).transactions.map((t) => t.externalId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[2]).toMatch(/^ofx:sha-/);
    expect(ids[3]).toBe(`${ids[2]}-2`);
    expect(ids[4]).toMatch(/^ofx:A1-[0-9a-f]{8}$/);
    expect(parseOfx(SGML_BANK).transactions.map((t) => t.externalId)).toEqual(ids);
  });

  it("lê fatura de cartão em XML", () => {
    const statement = parseOfx(XML_CARD);
    expect(statement.accountType).toBe("credit_card");
    expect(statement.transactions).toEqual([
      { externalId: "ofx:c-1", date: "2026-09-10", amountCents: -8990, description: "Farmácia & Drogaria" },
      { externalId: "ofx:c-2", date: "2026-09-12", amountCents: 150000, description: "Pagamento recebido" },
    ]);
  });
});

describe("decodeOfx", () => {
  it("decodifica Windows-1252 declarado no cabeçalho", () => {
    const header = "OFXHEADER:100\nCHARSET:1252\n\n<MEMO>";
    const bytes = new Uint8Array([...new TextEncoder().encode(header), 0x50, 0xc3, 0x4f]); // "PÃO" em 1252
    expect(decodeOfx(bytes)).toContain("<MEMO>PÃO");
  });

  it("decodifica UTF-8", () => {
    const bytes = new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?><MEMO>Pão');
    expect(decodeOfx(bytes)).toContain("Pão");
  });

  it("cai para 1252 quando não é UTF-8 válido", () => {
    const bytes = new Uint8Array([0x3c, 0x4d, 0x3e, 0xe7]); // "<M>ç" em 1252
    expect(decodeOfx(bytes)).toBe("<M>ç");
  });
});
