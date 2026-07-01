import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';


@Component({
  selector: 'app-landing',

  // Composant standalone (pas besoin de module Angular)
  standalone: true,

  // Modules utilisés dans cette page
  imports: [
    CommonModule,
    RouterLink
  ],

  template: `

    <!-- ================= HEADER ================= -->
    <header class="header">

      <!-- Logo + nom application -->
      <a class="brand" routerLink="/">

        <img
          src="assets/logo.png"
          alt="AeroServe">

        <div>
          <h2>AeroServe</h2>
          <span>
            Plateforme de gestion F&B
          </span>
        </div>

      </a>


      <!-- Menu navigation -->
      <nav>

        <a href="#features">
          Fonctionnalités
        </a>

        <a href="#roles">
          Rôles
        </a>

        <a href="#workflow">
          Workflow
        </a>


        <!-- Accès login -->
        <a
          class="btn"
          routerLink="/login">

          Connexion

        </a>


      </nav>


    </header>



    <!-- ================= SECTION PRINCIPALE ================= -->

    <main>


      <section class="hero">


        <div>


          <span class="tag">
            Aviation & restauration
          </span>


          <h1>

            Une plateforme unique
            pour gérer les opérations AeroServe

          </h1>



          <p>

            Gestion du stock,
            cuisine,
            hygiène,
            commandes internes,
            planning et ventes
            dans une seule application.

          </p>



          <div>


            <a
              class="btn"
              routerLink="/login">

              Accéder plateforme

            </a>



          </div>



        </div>



        <!-- Aperçu dashboard -->

        <div class="dashboard">


          <h3>
            Etat opérationnel
          </h3>



          <div>

            Commandes internes :
            <b>
              12 en attente
            </b>

          </div>



          <div>

            Alertes stock :
            <b>
              4 produits
            </b>

          </div>



          <div>

            Planning :
            <b>
              Actif
            </b>

          </div>



        </div>


      </section>





      <!-- ================= MODULES ================= -->


      <section
        id="features"
        class="cards">


        <article>


          <h3>
            Gestion Stock
          </h3>


          <p>

            Suivi produits,
            FIFO,
            mouvements et alertes.

          </p>


        </article>



        <article>


          <h3>
            Cuisine
          </h3>


          <p>

            Menus,
            recettes,
            besoins cuisine.

          </p>


        </article>




        <article>


          <h3>
            Planning
          </h3>


          <p>

            Gestion des équipes
            et points de vente.

          </p>


        </article>



      </section>






      <!-- ================= ROLES ================= -->


      <section id="roles">


        <h2>
          Rôles utilisateurs
        </h2>



        <div class="cards">


          <article>

            <h3>
              Super Admin
            </h3>


            <p>
              Gestion globale système
            </p>


          </article>



          <article>

            <h3>
              Chef Cuisine
            </h3>


            <p>
              Menus et recettes
            </p>


          </article>




          <article>

            <h3>
              Chef Magasin
            </h3>


            <p>
              Gestion stock
            </p>


          </article>



          <article>

            <h3>
              Responsable Achat
            </h3>


            <p>
              Approvisionnement
            </p>


          </article>




        </div>


      </section>







      <!-- ================= WORKFLOW ================= -->


      <section id="workflow">


        <h2>
          Workflow métier
        </h2>



        <div class="workflow">


          <span>
            1. Achat
          </span>


          <span>
            ↓
          </span>


          <span>
            2. Stock
          </span>


          <span>
            ↓
          </span>


          <span>
            3. Cuisine
          </span>


          <span>
            ↓
          </span>


          <span>
            4. Vente
          </span>


        </div>


      </section>



    </main>

  `,





  // ================= CSS =================

  styles: [`

    :host{

      display:block;

      padding:30px;

      background:#f5f5f2;

    }



    .header{

      display:flex;

      justify-content:space-between;

      align-items:center;

    }



    .brand{

      display:flex;

      gap:15px;

      align-items:center;

    }



    img{

      width:50px;

    }




    nav{

      display:flex;

      gap:20px;

    }



    .btn{

      background:#0d9488;

      color:white;

      padding:10px 20px;

      border-radius:8px;

    }




    .hero{

      display:grid;

      grid-template-columns:1fr 1fr;

      gap:30px;

      margin-top:50px;

    }



    .dashboard{

      background:#263238;

      color:white;

      padding:30px;

      border-radius:15px;

    }



    .cards{

      display:grid;

      grid-template-columns:repeat(3,1fr);

      gap:20px;

      margin-top:40px;

    }



    article{

      background:white;

      padding:20px;

      border-radius:15px;

    }



    .workflow{

      display:flex;

      gap:20px;

      padding:30px;

      background:white;

      border-radius:15px;

    }



  `]


})

export class LandingComponent {

}
