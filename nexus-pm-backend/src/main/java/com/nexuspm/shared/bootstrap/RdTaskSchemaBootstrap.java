package com.nexuspm.shared.bootstrap;

import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
public class RdTaskSchemaBootstrap {

    @Bean
    public static BeanFactoryPostProcessor rdTaskSchemaDependsOnPostProcessor() {
        return beanFactory -> {
            if (!beanFactory.containsBeanDefinition("entityManagerFactory")) {
                return;
            }
            BeanDefinition emf = beanFactory.getBeanDefinition("entityManagerFactory");
            emf.setDependsOn(StringUtils.concatenateStringArrays(
                    emf.getDependsOn(),
                    new String[] {"rdTaskTableInitializer"}));
        };
    }
}
