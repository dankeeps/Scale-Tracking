import { CheckCircle2, ExternalLink, FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/panel/page-header";
import {
  CopyBlock,
  SnippetBlock,
  WebhookUrlBlock,
} from "@/components/instructions/copy-block";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SUPABASE_CONFIGURED } from "@/lib/demo/mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Instruções · Ativar o sistema",
};

/** Link externo com ícone. */
function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
    >
      {children}
      <ExternalLink className="size-3" />
    </a>
  );
}

const STEPS = [
  { id: "contas", n: 1, title: "Abrir as contas necessárias" },
  { id: "supabase", n: 2, title: "Criar o banco no Supabase" },
  { id: "chaves", n: 3, title: "Ligar as chaves (sai do modo demonstração)" },
  { id: "deploy", n: 4, title: "Publicar na Vercel e apontar o domínio" },
  { id: "pixel", n: 5, title: "Meta: Pixel + token da Conversions API" },
  { id: "ads", n: 6, title: "Meta: token da conta de anúncio" },
  { id: "ga4", n: 7, title: "GA4: Measurement ID + API secret" },
  { id: "webhook", n: 8, title: "Webhook de compra na plataforma" },
  { id: "snippet", n: 9, title: "Instalar o script nas páginas" },
  { id: "produtos", n: 10, title: "Marca, produtos e ajustes finais" },
  { id: "testar", n: 11, title: "Testar tudo de ponta a ponta" },
] as const;

function Step({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader className="gap-1">
        <Badge variant="secondary" className="w-fit font-mono">
          Etapa {n}
        </Badge>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

/** Lista numerada padrão das etapas. */
function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 marker:font-mono marker:text-xs marker:text-primary">
      {children}
    </ol>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs">
      {children}
    </p>
  );
}

export default function InstrucoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Instruções"
        description="Passo a passo completo para tirar este sistema do modo demonstração e colocar para rastrear de verdade."
      />

      {/* Situação atual */}
      <Card variant="solid">
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          {SUPABASE_CONFIGURED ? (
            <>
              <CheckCircle2 className="size-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Supabase conectado</p>
                <p className="text-xs text-muted-foreground">
                  O painel está lendo dados reais e o login está ativo. Siga das
                  etapas 5 em diante para ligar Meta, GA4 e o webhook.
                </p>
              </div>
            </>
          ) : (
            <>
              <FlaskConical className="size-5 shrink-0 text-accent-amber" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Modo demonstração ativo</p>
                <p className="text-xs text-muted-foreground">
                  Tudo o que você vê nas outras abas é fictício, só para conhecer
                  o sistema. Nada é gravado e não há login. Complete a etapa 3 e o
                  modo demonstração desliga sozinho.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Índice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roteiro</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {STEPS.map((s) => (
              <li key={s.id} className="text-sm">
                <a
                  href={`#${s.id}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="mr-2 font-mono text-xs text-primary">
                    {String(s.n).padStart(2, "0")}
                  </span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Step id="contas" n={1} title="Abrir as contas necessárias">
        <p>
          Cada especialista tem a <strong>própria pilha</strong>: banco, deploy e
          credenciais separados. Antes de começar, garanta acesso a:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <A href="https://supabase.com">Supabase</A> — banco de dados e login
            do painel (plano gratuito resolve no início).
          </li>
          <li>
            <A href="https://vercel.com">Vercel</A> — onde o sistema fica no ar.
          </li>
          <li>
            <A href="https://business.facebook.com">Meta Business Manager</A> —
            Pixel, Conversions API e conta de anúncio.
          </li>
          <li>
            <A href="https://analytics.google.com">Google Analytics 4</A> —
            propriedade e fluxo de dados do site.
          </li>
          <li>
            Plataforma de venda (Hotmart, Kiwify ou Eduzz) com permissão para
            cadastrar webhook.
          </li>
          <li>Acesso ao DNS do domínio (para criar um subdomínio).</li>
        </ul>
        <Nota>
          Separe também <strong>onde ficam as páginas do funil</strong> (landing,
          VSL, checkout): você vai precisar colar um script em todas elas na
          etapa 9.
        </Nota>
      </Step>

      <Step id="supabase" n={2} title="Criar o banco no Supabase">
        <OL>
          <li>
            Em <A href="https://supabase.com/dashboard">supabase.com/dashboard</A>
            , clique em <strong>New project</strong>. Guarde a senha do banco em
            lugar seguro — ela não é exibida de novo.
          </li>
          <li>
            Abra <strong>Database → Extensions</strong> e confirme que estão
            habilitadas: <code>pgcrypto</code>, <code>supabase_vault</code> e{" "}
            <code>pg_cron</code>.
          </li>
          <li>
            Rode as migrations. Pelo terminal, na pasta do projeto:
            <CopyBlock
              className="mt-2"
              code={`npx supabase link --project-ref <REF-DO-PROJETO>\nnpx supabase db push`}
            />
            Sem CLI: abra o <strong>SQL Editor</strong> do Supabase e execute os
            arquivos de <code>supabase/migrations/</code> em ordem alfabética (do
            mais antigo para o mais novo), um de cada vez.
          </li>
          <li>
            Confira se a criptografia dos segredos funcionou — o resultado precisa
            ser <code>ok = true</code>:
            <CopyBlock
              className="mt-2"
              code={`select decrypt_secret(encrypt_secret('teste')) = 'teste' as ok;`}
            />
          </li>
          <li>
            Em <strong>Authentication → Sign In / Providers</strong>, deixe o
            cadastro público <strong>desligado</strong>. Este painel é privado:
            ninguém deve conseguir criar conta sozinho.
          </li>
          <li>
            Em <strong>Authentication → Users → Add user</strong>, crie o seu
            usuário (email + senha). É com ele que você vai entrar no painel.
          </li>
          <li>
            Em <strong>Project Settings → API</strong>, copie os três valores:{" "}
            <code>Project URL</code>, a chave <code>anon public</code> e a chave{" "}
            <code>service_role</code>.
          </li>
        </OL>
        <Nota>
          A <code>service_role</code> ignora todas as regras de segurança do
          banco. Ela só pode existir no servidor — nunca a coloque numa variável
          que comece com <code>NEXT_PUBLIC_</code> e nunca a cole em página,
          e-mail ou mensagem.
        </Nota>
      </Step>

      <Step id="chaves" n={3} title="Ligar as chaves (sai do modo demonstração)">
        <p>
          É este passo que desliga a demonstração: assim que as três variáveis
          existirem, o painel passa a ler o banco e o login volta a ser exigido.
        </p>
        <CopyBlock
          caption="No seu computador, crie o arquivo .env.local na raiz do projeto:"
          code={`NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>\nSUPABASE_SERVICE_ROLE_KEY=<service_role key>`}
        />
        <p>
          Na Vercel, as mesmas três em{" "}
          <strong>Settings → Environment Variables</strong> (ambientes Production,
          Preview e Development). Depois de salvar, faça um{" "}
          <strong>Redeploy</strong> — variáveis novas só valem em build novo.
        </p>
        <Nota>
          Nenhum token de Meta ou GA4 vai em variável de ambiente. Eles são
          cadastrados pelo painel e ficam <strong>cifrados no banco</strong>.
        </Nota>
      </Step>

      <Step id="deploy" n={4} title="Publicar na Vercel e apontar o domínio">
        <OL>
          <li>
            Suba o projeto para um repositório <strong>privado</strong> no GitHub.
          </li>
          <li>
            Na Vercel: <strong>Add New → Project</strong>, importe o repositório e
            cole as três variáveis da etapa anterior antes de fazer o deploy.
          </li>
          <li>
            Em <strong>Settings → Domains</strong>, adicione um subdomínio do
            cliente — por exemplo <code>dados.dominiodocliente.com</code> — e crie
            o registro <code>CNAME</code> que a Vercel indicar.
          </li>
        </OL>
        <Nota>
          Use um subdomínio do <strong>mesmo domínio do funil</strong>. É o que
          faz os cookies serem de primeira parte e o script escapar de boa parte
          dos bloqueadores — exatamente o motivo de o rastreamento ser
          server-side.
        </Nota>
      </Step>

      <Step id="pixel" n={5} title="Meta: Pixel + token da Conversions API">
        <OL>
          <li>
            Abra o{" "}
            <A href="https://business.facebook.com/events_manager">
              Gerenciador de Eventos
            </A>{" "}
            e selecione (ou crie em <strong>Conectar fontes de dados → Web</strong>
            ) o pixel do cliente.
          </li>
          <li>
            Copie o <strong>ID do pixel</strong> — são 15 ou 16 dígitos, no topo
            da tela.
          </li>
          <li>
            Vá em <strong>Configurações</strong> e desça até{" "}
            <strong>API de Conversões → Gerar token de acesso</strong>. Copie o
            token na hora: ele não é exibido de novo.
            <br />
            Se a opção não aparecer, gere por um usuário do sistema:{" "}
            <A href="https://business.facebook.com/settings/system-users">
              Configurações do Negócio → Usuários do sistema
            </A>{" "}
            → <strong>Gerar novo token</strong> → escolha o app → marque a
            permissão <code>ads_management</code> (ou <code>business_management</code>
            ) → atribua o pixel a esse usuário em{" "}
            <strong>Fontes de dados → Pixels → Adicionar pessoas</strong>.
          </li>
          <li>
            Ainda no Gerenciador de Eventos, aba <strong>Testar eventos</strong>,
            copie o <strong>código de teste</strong> (formato{" "}
            <code>TEST12345</code>) se quiser validar os disparos sem sujar os
            dados.
          </li>
          <li>
            No painel, vá em <strong>Configurações → Pixels Meta →
            Adicionar</strong>, cole ID e token, salve e clique em{" "}
            <strong>Testar conexão</strong>. O código de teste vai em{" "}
            <strong>Configurações → Geral</strong>.
          </li>
        </OL>
        <Nota>
          Pode cadastrar quantos pixels quiser: cada evento é enviado para todos
          os pixels ativos, sempre com o mesmo <code>event_id</code> do navegador
          — é isso que evita o Meta contar a mesma conversão duas vezes.
        </Nota>
      </Step>

      <Step id="ads" n={6} title="Meta: token da conta de anúncio">
        <p>
          Este token é o que alimenta a aba <strong>Campanhas</strong> (investido,
          ROAS, CPA) e permite pausar anúncios e mudar orçamento pelo painel.
        </p>
        <OL>
          <li>
            No{" "}
            <A href="https://adsmanager.facebook.com">Gerenciador de Anúncios</A>,
            copie o <strong>ID da conta</strong> (aparece como{" "}
            <code>act_1234567890</code>).
          </li>
          <li>
            Em <A href="https://developers.facebook.com/apps">
              developers.facebook.com → Meus apps
            </A>
            , crie um app do tipo <strong>Empresa</strong> (ou use um existente) e
            adicione o produto <strong>Marketing API</strong>.
          </li>
          <li>
            Em{" "}
            <A href="https://business.facebook.com/settings/system-users">
              Configurações do Negócio → Usuários do sistema
            </A>
            , crie um usuário do sistema com papel de administrador, atribua a ele
            a conta de anúncio e clique em <strong>Gerar novo token</strong>.
          </li>
          <li>
            Marque as permissões: <code>ads_read</code> (ler métricas) e{" "}
            <code>ads_management</code> (pausar/editar orçamento pelo painel).
            Tokens de usuário do sistema não expiram — prefira sempre eles.
          </li>
          <li>
            No painel: <strong>Configurações → Contas de anúncio →
            Adicionar</strong>, cole ID e token e use <strong>Testar conexão</strong>.
          </li>
        </OL>
        <Nota>
          O painel guarda os números do Meta em cache por cerca de 30 minutos para
          não estourar o limite da API. O botão <strong>Atualizar</strong> na aba
          Campanhas força a releitura quando você precisar do dado fresco.
        </Nota>
      </Step>

      <Step id="ga4" n={7} title="GA4: Measurement ID + API secret">
        <OL>
          <li>
            Em <A href="https://analytics.google.com">analytics.google.com</A>,
            abra <strong>Administrador</strong> e crie (ou escolha) a propriedade
            do cliente.
          </li>
          <li>
            Em <strong>Fluxos de dados → Web</strong>, cadastre o domínio do
            funil. O <strong>ID da métrica</strong> aparece no canto superior
            direito, no formato <code>G-XXXXXXXXXX</code>.
          </li>
          <li>
            No mesmo fluxo, desça até{" "}
            <strong>Protocolo de medição → Criar</strong>, dê um apelido e copie o{" "}
            <strong>valor do segredo</strong>.
          </li>
          <li>
            No painel: <strong>Configurações → GA4 → Adicionar</strong>, cole os
            dois campos e clique em <strong>Testar conexão</strong> (a validação
            usa o modo debug do GA, sem gravar nada).
          </li>
        </OL>
        <Nota>
          Divisão de trabalho: os eventos do site vão para o GA4 pelo próprio
          script no navegador. O Measurement Protocol (o API secret) só é usado
          para a <strong>compra que chega pelo webhook</strong> — ou seja,
          complementa o que o navegador não vê, sem duplicar nada.
        </Nota>
      </Step>

      <Step id="webhook" n={8} title="Webhook de compra na plataforma">
        <OL>
          <li>
            No painel, vá em <strong>Configurações → Geral</strong>, clique em{" "}
            <strong>Gerar</strong> no campo do token do webhook e salve. Copie o
            token antes de sair da tela.
          </li>
          <li>
            Copie a URL do webhook (o painel mostra pronta na mesma tela):
            <WebhookUrlBlock />
          </li>
          <li>
            Cadastre essa URL na plataforma de venda:
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>
                <strong>Hotmart</strong>: Ferramentas → Webhook (Postback) → Novo.
              </li>
              <li>
                <strong>Kiwify</strong>: Apps → Webhooks → Criar webhook.
              </li>
              <li>
                <strong>Eduzz</strong>: Configurações → Notificações /
                Integrações → URL de notificação.
              </li>
            </ul>
          </li>
          <li>
            Marque os eventos: <strong>compra aprovada</strong> (obrigatório) e,
            se quiser acompanhar no painel, também{" "}
            <strong>compra pendente/boleto gerado</strong>,{" "}
            <strong>reembolso</strong> e <strong>chargeback</strong>.
          </li>
          <li>
            Se a plataforma permitir enviar cabeçalhos, mande o token em{" "}
            <code>x-webhook-token</code> em vez de deixá-lo na URL — é mais
            seguro. As duas formas funcionam.
          </li>
        </OL>
        <Nota>
          A venda é casada ao visitante nesta ordem: <code>trck_user_id</code>{" "}
          (o mais confiável, vem do link decorado na etapa 9), depois e-mail,
          depois telefone. Cada transação só dispara <code>Purchase</code> uma
          vez, mesmo que a plataforma reenvie o webhook.
        </Nota>
      </Step>

      <Step id="snippet" n={9} title="Instalar o script nas páginas">
        <SnippetBlock />
        <p>
          Precisa estar em <strong>todas</strong> as páginas do funil — inclusive
          a de obrigado. Ele carrega o Pixel e a gtag sozinho, com os IDs que você
          cadastrou: não instale o pixel do Meta ou a tag do GA de novo, ou os
          eventos vão contar em dobro.
        </p>
        <CopyBlock
          caption="Links de checkout precisam ser decorados, para a venda casar com o visitante:"
          code={`<a href="https://pay.suaplataforma.com/xxxx" onclick="this.href = window.trck.decorate(this.href)">\n  Quero comprar\n</a>`}
        />
        <CopyBlock
          caption="Eventos personalizados (opcional), em qualquer ponto do site:"
          code={`window.trck.track("Lead");\nwindow.trck.track("InitiateCheckout", { value: 497, currency: "BRL" });\nwindow.trck.identify({ email: "cliente@exemplo.com", phone: "11999999999" });`}
        />
        <Nota>
          O <code>PageView</code> é disparado sozinho. E-mail e telefone passados
          em <code>identify</code> são convertidos em hash no servidor antes de
          irem para o Meta — dado pessoal cru nunca sai daqui.
        </Nota>
      </Step>

      <Step id="produtos" n={10} title="Marca, produtos e ajustes finais">
        <OL>
          <li>
            <strong>Nome e logo do painel</strong>: defina na Vercel as variáveis
            abaixo (opcionais) e faça redeploy.
            <CopyBlock
              className="mt-2"
              code={`NEXT_PUBLIC_BRAND_NAME=Nome do Especialista\nNEXT_PUBLIC_BRAND_LOGO=/logo.png`}
            />
            Sem a logo, o painel desenha as iniciais do nome. Para usar imagem,
            coloque o arquivo em <code>public/</code> e aponte o caminho.
          </li>
          <li>
            <strong>Moeda</strong>: em Configurações → Geral, ajuste se o produto
            não for vendido em BRL.
          </li>
          <li>
            <strong>Produtos</strong>: depois da primeira venda, a aba Produtos
            lista o que já foi vendido. Desligue o envio ao Meta dos que não devem
            otimizar campanha (order bumps e upsells costumam sujar o
            aprendizado).
          </li>
        </OL>
      </Step>

      <Step id="testar" n={11} title="Testar tudo de ponta a ponta">
        <OL>
          <li>
            Abra o site com <code>?fbtest=1</code> na URL, navegue e clique no
            checkout.
          </li>
          <li>
            No Meta, confira em <strong>Gerenciador de Eventos → Testar
            eventos</strong>: cada evento deve aparecer uma única vez, marcado
            como recebido por <strong>navegador e servidor</strong> (é a
            deduplicação funcionando).
          </li>
          <li>
            No GA4, use <strong>Administrador → DebugView</strong> para ver os
            eventos chegando.
          </li>
          <li>
            Faça uma <strong>compra de teste</strong> na plataforma. Em segundos
            ela deve aparecer na aba <strong>Vendas</strong>, com{" "}
            <em>casada</em> marcado.
          </li>
          <li>
            Na aba <strong>Eventos</strong>, abra o detalhe do{" "}
            <code>Purchase</code> e confira o payload e a resposta de cada
            destino — é aí que aparece qualquer erro de token.
          </li>
          <li>
            Por fim, confira <strong>Visão geral</strong> (funil, mapa, receita) e{" "}
            <strong>Campanhas</strong> (investido e ROAS).
          </li>
        </OL>
        <Nota>
          Não apareceu nada? Confira, nesta ordem: o script está na página (veja o
          arquivo <code>t.js</code> carregando na aba Rede do navegador), as
          contas estão marcadas como <strong>ativas</strong> em Configurações, o
          token do webhook confere, e o período selecionado no topo cobre o
          horário do teste.
        </Nota>
      </Step>

      <Card variant="solid">
        <CardHeader>
          <CardTitle className="text-base">Checklist de entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Projeto Supabase criado, migrations aplicadas e cadastro público desligado",
              "Usuário do painel criado e login testado",
              "Três variáveis do Supabase na Vercel + redeploy",
              "Subdomínio do cliente apontado e com HTTPS",
              "Pixel + token da Conversions API cadastrados e testados",
              "Conta de anúncio cadastrada e testada",
              "GA4 (Measurement ID + API secret) cadastrado e testado",
              "Token do webhook gerado e URL cadastrada na plataforma",
              "t.js em todas as páginas e links de checkout decorados",
              "Compra de teste aparecendo em Vendas e no Meta",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
