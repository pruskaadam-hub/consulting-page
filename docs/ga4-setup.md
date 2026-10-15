# Google Analytics pro Adam Pruška

Webový stream: `G-L6HVJMS1XE`. Property ID: `559071834`.
Stream je nastavený v Pages workflow a číselná služba v backendu.
Google tag se načte až po souhlasu návštěvníka. Soukromá administrace
se neměří. Dodaný úryvek Google scriptu se nevkládá mimo tento mechanismus.

## Ověření sběru dat

Otevřete https://adampruska.cz/, povolte měření a v Google Analytics
zkontrolujte **Přehledy → V reálném čase**. U nového streamu mohou data
chvíli nabíhat. Bez souhlasu nebo při blokování měření se návštěva neodešle.
Automatické testy mají všechny požadavky na Google zachycené a skutečná
data do GA4 neposílají.

## Přehledy v administraci

Pro statistiky uvnitř webové administrace vytvořte služební účet s přístupem
jen pro čtení k této konkrétní službě GA4. Přihlášení do Google Analytics
a vytvoření streamu tento přístup automaticky nezakládá.

1. Na https://console.cloud.google.com/projectcreate vytvořte projekt,
   například **Adam Pruska web**. Můžete použít existující vhodný projekt.
   Zkontrolujte, že je právě tento projekt vybraný nahoře v konzoli.
2. Otevřete https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com
   a zapněte **Google Analytics Data API** tlačítkem **Enable / Povolit**.
3. V **IAM a správa → Účty služeb / Service Accounts** vytvořte účet,
   například `web-analytics`. Udělení rolí účtu ke Google Cloud projektu
   je volitelné. Pro čtení Analytics není potřeba přidělit mu Owner ani Editor
   projektu; přístup k datům se přiděluje přímo v GA4 v následujícím kroku.
4. Zkopírujte zobrazený e-mail služebního účtu končící na
   `.iam.gserviceaccount.com`. V Google Analytics vyberte službu
   `559071834`, otevřete **Správce → Správa přístupů ke službě / Property
   access management**, přidejte tento e-mail s rolí **Čtenář / Viewer**.
5. V Google Cloud otevřete detail vytvořeného služebního účtu,
   **Klíče / Keys → Přidat klíč → Vytvořit nový klíč → JSON**.
   Soubor obsahuje soukromý klíč. Neposílejte ho do chatu ani do repozitáře.
6. V [Supabase Edge Functions → Secrets](https://supabase.com/dashboard/project/lsofzsartjesgwetcpzw/functions/secrets)
   přidejte **Name** `GOOGLE_SERVICE_ACCOUNT_JSON` a do chráněného pole
   **Value** vložte celý obsah staženého JSON souboru. Změnu uložte.
   Property ID už je nastavené; další secret s ID není nutný, pokud ho
   nechcete přepsat na jinou skutečnou službu.
7. Obnovte https://adampruska.cz/admin/ a otevřete **Návštěvnost**.
   U propojení se samostatně zobrazuje sběr dat na webu a nastavení přehledů
   v administraci. „Nastaveno“ potvrzuje konfiguraci, nikoli úspěšný report.

Přehled administrace zahrnuje posledních 30 dní do včerejška. Dnešní
návštěvy proto ověřujte v Realtime GA4. U nové služby může být první
report prázdný i při funkčním připojení.

Při chybě zkontrolujte, že Data API je zapnuté ve stejném Cloud projektu
jako služební účet, Viewer je přidělený k požadované službě GA4 a JSON
obsahuje celý původní klíč. Chybové zprávy aplikace nevypisují soukromý klíč
ani token.
