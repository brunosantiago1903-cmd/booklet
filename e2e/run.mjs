// Teste de ponta a ponta no app (http://localhost:3000) contra o Supabase local de e2e/start.sh.
// Uso: node e2e/run.mjs   (CHROMIUM_PATH opcional para usar um Chromium já instalado)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const CACHE = path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache");
const SHOTS = path.join(CACHE, "shots");
await mkdir(SHOTS, { recursive: true });
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const [Y, M, D] = today.split("-");
const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  results.push(`${condition ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
  if (!condition) failures += 1;
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "pt-BR" });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(`${msg.text()} @ ${msg.location().url} [${page.url()}]`);
});
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on("response", (res) => {
  if (res.status() >= 400 && !res.url().includes("/auth/v1/token")) consoleErrors.push(`${res.status()} ${res.url()}`);
});

async function login(email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}

async function text() {
  return (await page.locator("main").innerText()).replace(/\s+/g, " ");
}

async function chooseKind(label) {
  await page.getByRole("radio", { name: label, exact: true }).click();
}

async function selectByLabel(selector, labelText) {
  const value = await page.$eval(
    selector,
    (el, wanted) => [...el.options].find((o) => o.textContent.trim().startsWith(wanted))?.value,
    labelText,
  );
  if (!value) throw new Error(`opção "${labelText}" não encontrada em ${selector}`);
  await page.selectOption(selector, value);
}

// 1. Login com senha errada e depois certa
await login("ana@teste.com", "errada-123456");
await page.waitForSelector("text=E-mail ou senha incorretos.");
check("senha errada mostra erro", true);
await login("ana@teste.com", "senha-da-ana-123");
await page.waitForURL(`${BASE}/`);
check("login leva ao painel", (await text()).includes("Vamos começar"));
await page.screenshot({ path: `${SHOTS}/01-painel-vazio.png`, fullPage: true });

// 2. Conta corrente
await page.goto(`${BASE}/contas/nova`);
await page.fill("#name", "Conta Itaú");
await page.fill("#institution", "Itaú");
await page.fill("#initial_balance", "1.000,00");
await page.click("button[type=submit]");
await page.waitForURL(/\/contas\/[0-9a-f-]{36}$/);
check("conta criada com saldo inicial", (await text()).includes("R$ 1.000,00"), await text().then((t) => t.slice(0, 80)));

// 3. Cartão
await page.goto(`${BASE}/contas/nova`);
await page.getByRole("radio", { name: "Cartão de crédito" }).click();
await page.fill("#name", "Nubank");
await page.fill("#institution", "Nubank");
await page.fill("#closing_day", "3");
await page.fill("#due_day", "10");
await page.fill("#credit_limit", "5000");
await page.click("button[type=submit]");
await page.waitForURL(/\/contas\/[0-9a-f-]{36}$/);
const cardUrl = page.url();
check("cartão criado", (await text()).includes("Fatura de"));

// 4. Despesa no mercado com regra
await page.goto(`${BASE}/lancamentos/novo`);
await page.fill("#amount", "150,35");
await selectByLabel("#account_id", "Conta Itaú");
await page.fill("#description", "Mercado Dia");
await selectByLabel("#category_id", "Alimentação › Mercado");
await page.getByText("Usar esta categoria sempre").click();
await page.fill("input[name=rule_pattern]", "mercado");
await page.click("button[type=submit]");
await page.waitForURL(/\/lancamentos\?mes=/);
check("despesa aparece na lista", (await text()).includes("Mercado Dia"));

// 5. Compra parcelada no cartão
await page.goto(`${BASE}/lancamentos/novo`);
await page.fill("#amount", "1.200,00");
await selectByLabel("#account_id", "Nubank");
await page.selectOption("#installments", "3");
await page.fill("#description", "TV Sala");
await selectByLabel("#category_id", "Compras › Eletrônicos");
await page.click("button[type=submit]");
await page.waitForURL(/\/lancamentos\?mes=/);
check("parcela 1/3 listada", (await text()).includes("1/3"));

// 6. Receita
await page.goto(`${BASE}/lancamentos/novo?tipo=income`);
await page.fill("#amount", "5000");
await selectByLabel("#account_id", "Conta Itaú");
await page.fill("#description", "Salário");
await selectByLabel("#category_id", "Salário");
await page.click("button[type=submit]");
await page.waitForURL(/\/lancamentos\?mes=/);

// 7. Pagamento de fatura pela tela do cartão
await page.goto(`${BASE}/lancamentos/novo?tipo=transfer&para=${cardUrl.split("/").pop()}`);
await page.fill("#amount", "400");
await selectByLabel("#account_id", "Conta Itaú");
await page.click("button[type=submit]");
await page.waitForURL(/\/lancamentos\?mes=/);
check("transferência listada", (await text()).includes("Transferência"));

// 8. Painel com totais
await page.goto(`${BASE}/`);
let dash = await text();
check("saldo nas contas", dash.includes("R$ 5.449,65"), "esperado 1000 - 150,35 + 5000 - 400");
check("receitas do mês", dash.includes("R$ 5.000,00"));
check("despesas do mês (mercado + 1ª parcela)", dash.includes("R$ 550,35"));
check("gastos por categoria", dash.includes("Compras") && dash.includes("Alimentação"));
await page.screenshot({ path: `${SHOTS}/02-painel.png`, fullPage: true });

// 9. Orçamento estourado
await page.goto(`${BASE}/categorias`);
await page.locator("summary", { hasText: "Alimentação" }).click();
await page.fill('input[aria-label="Orçamento mensal de Alimentação"]', "100");
await page.locator('input[aria-label="Orçamento mensal de Alimentação"]').locator("xpath=ancestor::form").locator("button[type=submit]").click();
await page.waitForSelector("text=Orçamento salvo.");
await page.goto(`${BASE}/`);
dash = await text();
check("orçamento estourado sinalizado", dash.includes("Passou R$ 50,35 do orçamento"));

// 10. Fatura do cartão
await page.goto(cardUrl);
const cardText = await text();
check("fatura com parcela e pagamento", cardText.includes("R$ 400,00"));
await page.screenshot({ path: `${SHOTS}/03-cartao.png`, fullPage: true });

// 11. Importação OFX: vincula manuais, ignora repetidos, insere novos
const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${Y}${M}${D}<TRNAMT>-150.35<FITID>F1<MEMO>COMPRA MERCADO DIA
</STMTTRN><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${Y}${M}${D}<TRNAMT>-23.50<FITID>F2<MEMO>UBER *TRIP
</STMTTRN><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${Y}${M}${D}<TRNAMT>-400.00<FITID>F3<MEMO>PAGTO FATURA NUBANK
</STMTTRN><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${Y}${M}${D}<TRNAMT>-89.90<FITID>F4<MEMO>SUPERMERCADO EXTRA
</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
await writeFile(path.join(CACHE, "extrato.ofx"), ofx);
await page.goto(`${BASE}/mais/importar`);
await selectByLabel("#account_id", "Conta Itaú");
await page.setInputFiles("#file", path.join(CACHE, "extrato.ofx"));
await page.click("button[type=submit]");
await page.waitForSelector("text=/\\d+ importados/");
const importMsg = await text();
check("OFX: 2 novos e 2 vinculados", importMsg.includes("2 importados, 2 vinculados"), importMsg.match(/\d+ importados[^.]*/)?.[0]);
await selectByLabel("#account_id", "Conta Itaú");
await page.setInputFiles("#file", path.join(CACHE, "extrato.ofx"));
await page.click("button[type=submit]");
await page.waitForSelector("text=/0 importados/", { timeout: 15000 }).catch(() => {});
const reimport = await text();
check("OFX reimportado não duplica", reimport.includes("0 importados"), reimport.match(/\d+ importados[^.]*/)?.[0]);

await page.goto(`${BASE}/lancamentos?q=supermercado`);
const searchText = await text();
check("regra 'mercado' categorizou importado", searchText.includes("SUPERMERCADO EXTRA") && searchText.includes("Alimentação › Mercado"));
await page.goto(`${BASE}/`);
dash = await text();
check("saldo após OFX", dash.includes("R$ 5.336,25"), "5449,65 - 23,50 - 89,90");

// 12. Comprovante (IA desligada no teste): upload, revisão manual, confirmação
await page.setContent(`<div style="font:16px sans-serif;padding:24px;width:360px;background:#fff">
  <h2>Comprovante Pix</h2><p>Valor: R$ 42,00</p><p>Para: Padaria Pão Quente</p><p>Data: ${D}/${M}/${Y}</p></div>`);
await page.locator("div").first().screenshot({ path: path.join(CACHE, "comprovante.png") });
await page.goto(`${BASE}/comprovantes`);
check("aviso de IA desligada", (await text()).includes("Leitura automática desligada"));
await page.locator("input[type=file]:not([capture])").setInputFiles(path.join(CACHE, "comprovante.png"));
await page.waitForURL(/\/comprovantes\/[0-9a-f-]{36}$/, { timeout: 20000 });
check("comprovante enviado e aberto para revisão", (await text()).includes("Preencha o lançamento"));
check("prévia da imagem via link assinado", (await page.locator("img[alt='Comprovante enviado']").count()) === 1);
await page.screenshot({ path: `${SHOTS}/04-comprovante.png`, fullPage: true });
await page.fill("#amount", "42");
await page.fill("#description", "Padaria Pão Quente");
await selectByLabel("#category_id", "Alimentação › Padaria e lanches");
await page.click("button[type=submit]:has-text('Confirmar lançamento')");
await page.waitForURL(/\/lancamentos/);
await page.goto(`${BASE}/comprovantes`);
check("comprovante marcado como lançado", (await text()).includes("Lançado"));

// 13. Edição: muda categoria do Uber e cria regra
await page.goto(`${BASE}/lancamentos?q=uber`);
await page.locator("a", { hasText: "UBER *TRIP" }).first().click();
await page.waitForURL(/\/lancamentos\/[0-9a-f-]{36}$/);
check("lançamento importado tem valor travado", await page.locator("#amount").evaluate((el) => el.readOnly));
await selectByLabel("#category_id", "Transporte › App de transporte");
await page.getByText("Usar esta categoria sempre").click();
check("trecho sugerido para regra", (await page.inputValue("input[name=rule_pattern]")) === "uber trip");
await page.click("button[type=submit]:has-text('Salvar alterações')");
await page.waitForURL(/\/lancamentos\?mes=/);
check("categoria atualizada", (await text()).includes("Transporte › App de transporte"));
await page.screenshot({ path: `${SHOTS}/05-lancamentos.png`, fullPage: true });

// 14. Excluir parcelas em grupo
await page.goto(`${BASE}/lancamentos?q=TV`);
await page.locator("a", { hasText: "TV Sala" }).first().click();
await page.waitForURL(/\/lancamentos\/[0-9a-f-]{36}$/);
check("tela da parcela explica o grupo", (await text()).includes("Parcela 1 de 3"));

// 15. Mais: nome e conexões
await page.goto(`${BASE}/mais`);
check("página Mais", (await text()).includes("Categorização com IA"));
await page.screenshot({ path: `${SHOTS}/06-mais.png`, fullPage: true });
await page.goto(`${BASE}/mais/conexoes`);
check("tela de Open Finance", (await text()).includes("Conectar banco pelo Meu Pluggy"));

// 16. Segundo membro vê os mesmos dados
await page.goto(`${BASE}/mais`);
await page.click("button:has-text('Sair')");
await page.waitForURL(`${BASE}/login`);
await login("bruno@teste.com", "senha-do-bruno-123");
await page.waitForURL(`${BASE}/`);
dash = await text();
check("Bruno vê o painel do casal", dash.includes("Olá, Bruno") && dash.includes("R$ 5.294,25"), "saldo após padaria");
await page.goto(`${BASE}/mais`);
check("casal com dois membros", (await text()).includes("Ana e Bruno"));

// 17. Usuário fora da lista
await page.click("button:has-text('Sair')");
await page.waitForURL(`${BASE}/login`);
await login("intruso@teste.com", "senha-intruso-123");
await page.waitForURL(`${BASE}/sem-acesso`);
check("e-mail não autorizado é barrado", (await text()).includes("Acesso não autorizado"));

// 18. Tema escuro
const dark = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark" });
const darkPage = await dark.newPage();
await darkPage.goto(`${BASE}/login`);
await darkPage.fill("#email", "ana@teste.com");
await darkPage.fill("#password", "senha-da-ana-123");
await darkPage.click("button[type=submit]");
await darkPage.waitForURL(`${BASE}/`);
await darkPage.screenshot({ path: `${SHOTS}/07-painel-escuro.png`, fullPage: true });
check("tema escuro aplicado", (await darkPage.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(13, 13, 13)");

// 19. Cron com segredo
const cron = await fetch(`${BASE}/api/cron/sync`, { headers: { authorization: "Bearer segredo-cron-teste" } });
check("cron autenticado responde", cron.status === 200, String(cron.status));

check("sem erros no console do navegador", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();
console.log(results.join("\n"));
console.log(failures === 0 ? "\nTODOS OS CENÁRIOS PASSARAM" : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
