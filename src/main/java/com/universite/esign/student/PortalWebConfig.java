package com.universite.esign.student;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** URL courte du portail étudiant, à mettre en lien dans l'ENT : /etudiant (ou /etudiant/?sso=1). */
@Configuration(proxyBeanMethods = false)
class PortalWebConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addRedirectViewController("/etudiant", "/etudiant/");
        registry.addViewController("/etudiant/").setViewName("forward:/etudiant/index.html");
    }
}
